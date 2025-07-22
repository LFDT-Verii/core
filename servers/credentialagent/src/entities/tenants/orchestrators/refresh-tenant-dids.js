/**
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const { resolveDid } = require('@verii/common-fetchers');
const { leafMap } = require('@verii/common-functions');
const {
  getDidAndAliases,
  isDidUrlWithFragment,
  toDidUrl,
} = require('@verii/did-doc');
const { find, startsWith, omitBy, isNil, isEmpty, map } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const newError = require('http-errors');
const {
  splitDidUrlWithFragment,
} = require('@verii/did-doc/src/did-parsing');

const refreshTenantDids = async ({ all, did }, context) => {
  const { repos, log } = context;
  const filter = all ? {} : { did };
  const tenants = await repos.tenants.find({ filter });
  if (isEmpty(tenants)) {
    throw newError.BadRequest('No tenants to refresh');
  }
  const [offersCursor, didMap] = await Promise.all([
    repos.offers.collection().find({
      consentedAt: { $exists: false },
      rejectedAt: { $exists: false },
      'issuer.id': { $in: map('did', tenants) },
    }),
    buildCurrentDidToPreferredDid(tenants, context),
  ]);

  const tenantWrites = buildTenantWrites(tenants, didMap);
  const offerWrites = await buildOfferWrites(offersCursor, didMap);

  const proms = [];
  if (!isEmpty(tenantWrites)) {
    proms.push(repos.tenants.collection().bulkWrite(tenantWrites));
  }
  if (!isEmpty(offerWrites)) {
    proms.push(repos.offers.collection().bulkWrite(offerWrites));
  }
  const [tenantsBulkResult, offersBulkResult] = await Promise.all(proms);
  log.info({ tenantsBulkResult, offersBulkResult });

  return {};
};

const buildTenantWrites = (tenantDocs, didMap) => {
  const tenantWrites = [];
  for (const doc of tenantDocs) {
    const write = buildTenantWrite(doc, didMap);
    if (write != null) {
      tenantWrites.push(write);
    }
  }
  return tenantWrites;
};

const buildTenantWrite = (tenantDoc, didMap) => {
  const { preferredDid, dids } = didMap.get(tenantDoc.did) ?? {};
  if (preferredDid == null) {
    return undefined;
  }
  const serviceIds = map((serviceId) => {
    if (!isDidUrlWithFragment(serviceId)) {
      return serviceId;
    }
    const [, fragment] = splitDidUrlWithFragment(serviceId);
    return toDidUrl(preferredDid, fragment);
  }, tenantDoc.serviceIds);
  return {
    updateOne: {
      filter: { _id: new ObjectId(tenantDoc._id) },
      update: {
        $set: omitBy(isNil)({
          did: preferredDid,
          dids,
          serviceIds,
          updatedAt: new Date(),
        }),
      },
    },
  };
};

const buildOfferWrites = async (offersCursor, didMap) => {
  const offerWrites = [];
  for await (const doc of offersCursor) {
    const write = buildOfferWrite(doc, didMap);
    if (write != null) {
      offerWrites.push(write);
    }
  }
  return offerWrites;
};
const buildOfferWrite = (offerDoc, didMap) => {
  const oldDid = offerDoc.issuer.id;
  const { preferredDid } = didMap.get(oldDid) ?? {};
  if (preferredDid == null) {
    return undefined;
  }
  return {
    updateOne: {
      filter: { _id: new ObjectId(offerDoc._id) },
      update: {
        $set: omitBy(isNil)({
          'issuer.id': preferredDid,
          updatedAt: new Date(),
          credentialSubject: leafMap(
            (val) => (val === oldDid ? preferredDid : val),
            offerDoc.credentialSubject
          ),
        }),
      },
    },
  };
};

const buildCurrentDidToPreferredDid = async (tenantDocs, context) => {
  const didMap = new Map();
  for (const tenantDoc of tenantDocs) {
    const { did } = tenantDoc;
    // eslint-disable-next-line no-await-in-loop
    const didDoc = await resolveDid(did, context);
    const dids = getDidAndAliases(didDoc);
    const preferredDid = find(startsWith('did:web'), dids);
    if (preferredDid != null) {
      didMap.set(did, { preferredDid, dids });
    }
  }
  return didMap;
};

module.exports = { refreshTenantDids };
