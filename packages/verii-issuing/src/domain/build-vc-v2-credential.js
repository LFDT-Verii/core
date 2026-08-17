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
const { getV2CredentialModelViolation } = require('@verii/jwt');
const {
  VeriiProtocolVersions,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { castArray, isEmpty, isObject, omit, uniq } = require('lodash/fp');

/** @import { CredentialOffer, CredentialTypeMetadata, Issuer } from "../../types/types" */
/** @import { VcV2Credential, VcV2CredentialBuildOptions, VcV2LinkedData } from "../../types/types" */

const VC_V1_CONTEXT = 'https://www.w3.org/2018/credentials/v1';
const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

/**
 * Builds a conforming Velocity VC Data Model 2.0 document directly from
 * issuance inputs.
 * @param {VcV2CredentialBuildOptions} options credential build options
 * @returns {VcV2Credential} VC Data Model 2.0 document
 */
const buildVcV2Credential = (options) => {
  assertBuildOptions(options);

  const {
    contentHash,
    context,
    credentialId,
    credentialSubjectId,
    credentialTypeMetadata,
    issuer,
    offer,
    revocationUrl,
  } = options;
  const extensionContext = context.config.credentialExtensionsContextUrl;
  const validity = buildValidity(offer);
  assertValidity(validity);

  /** @type {VcV2Credential} */
  const credential = {
    '@context': uniq([
      VC_V2_CONTEXT,
      ...buildAllowlistedContexts(
        credentialTypeMetadata,
        offer,
        extensionContext,
      ),
    ]),
    contentHash: {
      type: 'VelocityContentHash2020',
      value: contentHash,
    },
    credentialSchema: offer.credentialSchema ?? {
      id: credentialTypeMetadata.schemaUrl,
      type: 'JsonSchemaValidator2018',
    },
    credentialStatus: buildCredentialStatus(offer, revocationUrl),
    credentialSubject: buildCredentialSubject(offer, credentialSubjectId),
    id: credentialId,
    issuer: buildIssuer(issuer, offer),
    type: uniq([
      'VerifiableCredential',
      ...castArray(offer.type).filter(
        (type) => type !== 'VerifiableCredential',
      ),
    ]),
    validFrom: validity.from,
    vnfProtocolVersion: isEmpty(credentialSubjectId)
      ? VeriiProtocolVersions.PROTOCOL_VERSION_1
      : VeriiProtocolVersions.PROTOCOL_VERSION_2,
  };

  if (validity.until != null) {
    credential.validUntil = validity.until;
  }

  const refreshService = buildRefreshService(issuer, offer);
  if (refreshService != null) {
    credential.refreshService = refreshService;
  }

  assertBuiltCredential(credential);

  return credential;
};

/**
 * Validates the emitted VC 2.0 profile.
 * @param {VcV2Credential} credential emitted credential
 * @returns {void}
 */
const assertBuiltCredential = (credential) => {
  const violation = getV2CredentialModelViolation(credential);
  if (violation == null) {
    return;
  }
  const property = violation.property == null ? '' : `: ${violation.property}`;
  const profile =
    violation.type === 'profile'
      ? 'Velocity profile'
      : `${violation.type} profile`;
  throw new TypeError(
    `Built VC 2.0 document violates the ${profile}${property}`,
  );
};

/**
 * Validates credential builder dependencies.
 * @param {VcV2CredentialBuildOptions} options credential build options
 * @returns {void}
 */
const assertBuildOptions = (options) => {
  assertObject('credential build options', options);
  assertNonEmptyString('contentHash', options.contentHash);
  assertNonEmptyString('credentialId', options.credentialId);
  assertObject('issuer', options.issuer);
  assertNonEmptyString('issuer.did', options.issuer.did);
  assertNonEmptyString('revocationUrl', options.revocationUrl);
  assertObject('offer', options.offer);
  assertObject('a credentialSubject object', options.offer.credentialSubject);
  assertObject('credential type metadata', options.credentialTypeMetadata);
  assertObject('context', options.context);
  assertObject('context config', options.context.config);
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
 * Requires a named non-empty string.
 * @param {string} name input name
 * @param {unknown} value input value
 * @returns {void}
 */
const assertNonEmptyString = (name, value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`VC 2.0 builder requires ${name}`);
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
    throw new TypeError(`VC 2.0 builder requires ${name}`);
  }
};

/**
 * Validates the credential validity interval.
 * @param {{from: string, until?: string}} validity credential validity
 * @returns {void}
 */
const assertValidity = (validity) => {
  if (
    validity.until != null &&
    Date.parse(validity.from) > Date.parse(validity.until)
  ) {
    throw new TypeError('VC 2.0 validity end must not precede its start');
  }
};

/**
 * Appends linked data without mutating caller-owned arrays.
 * @param {VcV2LinkedData | VcV2LinkedData[] | undefined} existing existing linked data
 * @param {VcV2LinkedData} value linked data to append
 * @returns {VcV2LinkedData | VcV2LinkedData[]} combined linked data
 */
const appendLinkedData = (existing, value) => {
  if (existing == null) {
    return value;
  }
  return [...castArray(existing), value];
};

/**
 * Builds contexts from pinned type and deployment configuration.
 * @param {CredentialTypeMetadata} credentialTypeMetadata type metadata
 * @param {CredentialOffer} offer validated credential offer
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
 * Builds the credential status value without mutating the offer.
 * @param {CredentialOffer} offer validated credential offer
 * @param {string} revocationUrl credential status URL
 * @returns {VcV2Credential['credentialStatus']} credential status value
 */
const buildCredentialStatus = (offer, revocationUrl) =>
  appendLinkedData(offer.credentialStatus, {
    id: revocationUrl,
    type: VelocityRevocationListType,
  });

/**
 * Builds a VC 2.0 credential subject with authoritative holder binding.
 * @param {CredentialOffer} offer validated credential offer
 * @param {string | undefined} credentialSubjectId bound holder identifier
 * @returns {VcV2Credential['credentialSubject']} credential subject
 */
const buildCredentialSubject = (offer, credentialSubjectId) => {
  const credentialSubject = omit(
    ['id', 'vendorUserId'],
    offer.credentialSubject,
  );
  const holder = resolveHolder(offer, credentialSubjectId);
  if (!isEmpty(holder)) {
    // eslint-disable-next-line better-mutation/no-mutation
    credentialSubject.id = holder;
  }
  return credentialSubject;
};

/**
 * Builds issuer branding with the authoritative issuer DID.
 * @param {Issuer} issuer issuer entity
 * @param {CredentialOffer} offer validated credential offer
 * @returns {VcV2Credential['issuer']} credential issuer
 */
const buildIssuer = (issuer, offer) =>
  isObject(offer.issuer)
    ? {
        id: issuer.did,
        ...omit(['id', 'vendorOrganizationId'], offer.issuer),
      }
    : { id: issuer.did };

/**
 * Builds the optional refresh-service value without mutating the offer.
 * @param {Issuer} issuer issuer entity
 * @param {CredentialOffer} offer validated credential offer
 * @returns {VcV2Credential['refreshService']} refresh service value
 */
const buildRefreshService = (issuer, offer) => {
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
 * Builds the credential validity interval.
 * @param {CredentialOffer} offer validated credential offer
 * @returns {{from: string, until?: string}} credential validity
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
 * Normalizes a polymorphic context value to an array.
 * @param {unknown} value context value
 * @returns {unknown[]} normalized context entries
 */
const extractContexts = (value) => (value == null ? [] : castArray(value));

/**
 * Resolves the effective holder identifier.
 * @param {CredentialOffer} offer validated credential offer
 * @param {string | undefined} credentialSubjectId bound holder identifier
 * @returns {string | undefined} effective holder identifier
 */
const resolveHolder = (offer, credentialSubjectId) =>
  isEmpty(credentialSubjectId)
    ? offer.credentialSubject.id
    : credentialSubjectId;

module.exports = { buildVcV2Credential };
