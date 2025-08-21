/**
 * Copyright 2023 Velocity Team
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

const { pick, mapValues, flow, isEmpty, map, isObject } = require('lodash/fp');

const { hashOffer } = require('@verii/verii-issuing');
const { generateLinkCode } = require('./generate-link-code');

const buildOffer = (offer, credentialRefsMap, { tenant, exchange }) => {
  const { relatedResource, replaces } = flow(
    pick(['relatedResource', 'replaces']),
    mapValues(map(buildRelatedResource(credentialRefsMap)))
  )(offer);

  const linkedCredentials = buildLinkedCredentials(
    offer.linkedCredentials,
    credentialRefsMap
  );

  const { linkCode, linkCodeCommitment } = generateLinkCode();
  const issuer =
    offer.issuer != null && isObject(offer.issuer)
      ? {
          id: tenant.did,
          ...offer.issuer,
        }
      : { id: tenant.did };

  return {
    ...offer,
    issuer,
    exchangeId: exchange._id,
    contentHash: {
      type: 'VelocityContentHash2020',
      value: hashOffer(offer),
    },
    linkCode,
    linkCodeCommitment,
    linkedCredentials,
    relatedResource,
    replaces,
  };
};

const buildRelatedResource = (offersMap) => (resource) => {
  const offer = offersMap[resource.id];
  if (isEmpty(offer)) return resource;
  return {
    ...resource,
    digestSRI: offer?.digestSRI,
    hint: offer.type,
  };
};

const buildLinkedCredentials = (linkedCredentialList, credentialRefsMap) => {
  if (isEmpty(linkedCredentialList)) {
    return undefined;
  }

  return map((linkedCredential) => {
    const credentialRef =
      credentialRefsMap[linkedCredential.linkedCredentialId];
    if (credentialRef == null) {
      return {
        ...linkedCredential,
        invalidAt: new Date(),
        invalidReason: `Revoked offer ${linkedCredential.linkedCredentialId} not found`,
      };
    }

    return { ...linkedCredential, linkCode: credentialRef.linkCode };
  }, linkedCredentialList);
};

module.exports = { buildOffer };
