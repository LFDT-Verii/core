/**
 * Copyright 2026 Velocity Team
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

const { toRelativeServiceId } = require('@verii/did-doc');
const {
  VeriiProtocolVersions,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { castArray, isEmpty, isObject, omit, uniq } = require('lodash/fp');

const VC_V1_CONTEXT = 'https://www.w3.org/2018/credentials/v1';
const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

/**
 * Converts a validated credential offer into version-neutral representation
 * input. It deliberately uses interval and protocol metadata rather than
 * credential-generation-specific property names.
 * @param {object} args credential construction dependencies
 * @param {string} args.contentHash canonical content hash
 * @param {object} args.context application context
 * @param {string} args.credentialId credential identifier
 * @param {string} [args.credentialSubjectId] holder identifier
 * @param {object} args.credentialTypeMetadata credential type metadata
 * @param {object} args.issuer issuer entity
 * @param {object} args.offer validated credential offer
 * @param {string} args.revocationUrl credential status URL
 * @returns {object} canonical credential input
 */
const buildCredentialInput = ({
  contentHash,
  context,
  credentialId,
  credentialSubjectId,
  credentialTypeMetadata,
  issuer,
  offer,
  revocationUrl,
}) => {
  assertBuildArguments({
    contentHash,
    context,
    credentialId,
    credentialTypeMetadata,
    issuer,
    offer,
    revocationUrl,
  });

  const extensionContext = context.config.credentialExtensionsContextUrl;

  return {
    claims: omit(['id', 'vendorUserId'], offer.credentialSubject),
    contentHash,
    contexts: buildAllowlistedContexts(
      credentialTypeMetadata,
      offer,
      extensionContext,
    ),
    extensionContext,
    holder: resolveHolder(offer, credentialSubjectId),
    id: credentialId,
    issuer: buildCanonicalIssuer(issuer, offer),
    refreshService: buildCanonicalRefreshService(issuer, offer),
    schema: offer.credentialSchema ?? {
      id: credentialTypeMetadata.schemaUrl,
      type: 'JsonSchemaValidator2018',
    },
    status: buildCanonicalStatus(offer, revocationUrl),
    types: uniq(castArray(offer.type)),
    validity: buildValidity(offer),
    vnfProtocol: buildVnfProtocol(credentialSubjectId),
  };
};

/**
 * Validates canonical builder dependencies.
 * @param {object} args credential construction dependencies
 * @param {string} args.contentHash canonical content hash
 * @param {object} args.context application context
 * @param {string} args.credentialId credential identifier
 * @param {object} args.credentialTypeMetadata credential type metadata
 * @param {object} args.issuer issuer entity
 * @param {object} args.offer validated credential offer
 * @param {string} args.revocationUrl credential status URL
 * @returns {void}
 */
const assertBuildArguments = ({
  contentHash,
  context,
  credentialId,
  credentialTypeMetadata,
  issuer,
  offer,
  revocationUrl,
}) => {
  assertNonEmptyString('contentHash', contentHash);
  assertNonEmptyString('credentialId', credentialId);
  assertNonEmptyString('issuer.did', issuer?.did);
  assertNonEmptyString('revocationUrl', revocationUrl);
  assertObject('a credentialSubject object', offer?.credentialSubject);
  assertObject('credential type metadata', credentialTypeMetadata);
  assertObject('context config', context?.config);
};

/**
 * Requires a named non-empty string.
 * @param {string} name input name
 * @param {unknown} value input value
 * @returns {void}
 */
const assertNonEmptyString = (name, value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Canonical credential input requires ${name}`);
  }
};

/**
 * Requires a named object.
 * @param {string} name input name
 * @param {unknown} value input value
 * @returns {void}
 */
const assertObject = (name, value) => {
  if (!isObject(value)) {
    throw new TypeError(`Canonical credential input requires ${name}`);
  }
};

/**
 * Requires a configured HTTPS JSON-LD context URL.
 * @param {unknown} value context candidate
 * @returns {void}
 */
const assertHttpsContext = (value) => {
  if (typeof value !== 'string') {
    throw new TypeError('VC 2.0 credential contexts must be pinned URLs');
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`VC 2.0 credential context is invalid: ${value}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new TypeError(`VC 2.0 credential context must use HTTPS: ${value}`);
  }
};

/**
 * Builds contexts from pinned type and deployment configuration.
 * @param {object} credentialTypeMetadata credential type metadata
 * @param {object} offer validated credential offer
 * @param {string} extensionContext pinned Velocity extension context
 * @returns {string[]} allowlisted extension contexts
 */
const buildAllowlistedContexts = (
  credentialTypeMetadata,
  offer,
  extensionContext,
) => {
  const configuredContexts = [
    ...extractContexts(credentialTypeMetadata.jsonldContext),
    extensionContext,
  ].filter((value) => value !== VC_V1_CONTEXT && value !== VC_V2_CONTEXT);
  configuredContexts.forEach(assertHttpsContext);

  const allowlist = new Set(configuredContexts);
  const offeredContexts = extractContexts(offer['@context']).filter(
    (value) => value !== VC_V1_CONTEXT && value !== VC_V2_CONTEXT,
  );
  for (const offeredContext of offeredContexts) {
    if (!allowlist.has(offeredContext)) {
      throw new TypeError(
        `VC 2.0 credential context is not allowlisted: ${String(
          offeredContext,
        )}`,
      );
    }
  }

  return uniq([...configuredContexts, ...offeredContexts]);
};

/**
 * Builds issuer branding with the authoritative issuer DID.
 * @param {object} issuer issuer entity
 * @param {object} offer validated credential offer
 * @returns {object} credential issuer
 */
const buildCanonicalIssuer = (issuer, offer) =>
  isObject(offer.issuer)
    ? {
        id: issuer.did,
        ...omit(['id', 'vendorOrganizationId'], offer.issuer),
      }
    : { id: issuer.did };

/**
 * Builds the optional refresh-service value without mutating the offer.
 * @param {object} issuer issuer entity
 * @param {object} offer validated credential offer
 * @returns {object | object[] | undefined} refresh service value
 */
const buildCanonicalRefreshService = (issuer, offer) => {
  if (issuer.issuingRefreshServiceId == null) {
    return offer.refreshService;
  }

  const velocityRefreshService = {
    id: `${issuer.did}${toRelativeServiceId(issuer.issuingRefreshServiceId)}`,
    type: 'VelocityNetworkRefreshService2024',
  };
  return appendLinkedData(offer.refreshService, velocityRefreshService);
};

/**
 * Builds the credential status value without mutating the offer.
 * @param {object} offer validated credential offer
 * @param {string} revocationUrl credential status URL
 * @returns {object | object[]} credential status value
 */
const buildCanonicalStatus = (offer, revocationUrl) =>
  appendLinkedData(offer.credentialStatus, {
    id: revocationUrl,
    type: VelocityRevocationListType,
  });

/**
 * Builds a representation-neutral validity interval.
 * @param {object} offer validated credential offer
 * @returns {{from: string, until: string | undefined}} validity interval
 */
const buildValidity = (offer) => ({
  from:
    offer.validFrom ??
    offer.issuanceDate ??
    offer.issued ??
    new Date().toISOString(),
  until: offer.validUntil ?? offer.expirationDate,
});

/**
 * Builds representation-neutral Velocity protocol metadata.
 * @param {string | undefined} credentialSubjectId bound holder identifier
 * @returns {{version: number}} protocol metadata
 */
const buildVnfProtocol = (credentialSubjectId) => ({
  version: isEmpty(credentialSubjectId)
    ? VeriiProtocolVersions.PROTOCOL_VERSION_1
    : VeriiProtocolVersions.PROTOCOL_VERSION_2,
});

/**
 * Appends linked data without mutating caller-owned arrays.
 * @param {object | object[] | undefined} existing existing linked data
 * @param {object} value linked data to append
 * @returns {object | object[]} combined linked data
 */
const appendLinkedData = (existing, value) => {
  if (existing == null) {
    return value;
  }
  return [...castArray(existing), value];
};

/**
 * Normalizes a polymorphic context value to an array.
 * @param {unknown} value context value
 * @returns {unknown[]} normalized context entries
 */
const extractContexts = (value) => (value == null ? [] : castArray(value));

/**
 * Resolves the effective holder without preserving a representation field.
 * @param {object} offer validated credential offer
 * @param {string | undefined} credentialSubjectId bound holder identifier
 * @returns {string | undefined} effective holder identifier
 */
const resolveHolder = (offer, credentialSubjectId) =>
  isEmpty(credentialSubjectId)
    ? offer.credentialSubject.id
    : credentialSubjectId;

module.exports = { buildCredentialInput };
