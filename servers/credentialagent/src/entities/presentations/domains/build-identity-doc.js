/*
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
 *
 */

const {
  reduce,
  flow,
  get,
  filter,
  first,
  omitBy,
  isNil,
} = require('lodash/fp');
const {
  extractFieldsFromIdCredential,
} = require('./extract-fields-from-id-credential');

const buildIdentityDoc = (credentials, context) =>
  reduce(
    (acc, { credential, credentialChecks }) => {
      const docCredential = buildDocCredential(
        credential,
        credentialChecks,
        context
      );

      if (['PhoneV1.0', 'Phone'].includes(docCredential.credentialType)) {
        acc.phoneCredentials.push(docCredential);
        acc.phones.push(credential?.credentialSubject?.phone);
        return acc;
      }
      if (['EmailV1.0', 'Email'].includes(docCredential.credentialType)) {
        acc.emailCredentials.push(docCredential);
        acc.emails.push(credential?.credentialSubject?.email);
        return acc;
      }

      acc.idDocumentCredentials.push(docCredential);
      return {
        ...acc,
        ...extractFieldsFromIdCredential(
          docCredential.credentialType,
          credential,
          context
        ),
      };
    },
    {
      emails: [],
      phones: [],
      emailCredentials: [],
      idDocumentCredentials: [],
      phoneCredentials: [],
    },
    credentials
  );

const buildDocCredential = (credential, credentialChecks, context) => {
  const basicDocCredential = {
    credentialType: flow([
      get('type'),
      filter((type) => type !== 'VerifiableCredential'),
      first,
    ])(credential),
    issuer: credential.issuer,
    issuanceDate: credential.issuanceDate,
    validUntil: extractValidUntil(credential),
    validFrom: extractValidFrom(credential),
    ...addWebhookSpecificFields(credential, credentialChecks, context),
  };

  if (context.config.vendorCredentialsIncludeIssuedClaim) {
    basicDocCredential.issued = credential.issuanceDate;
  }

  return omitBy(isNil, basicDocCredential);
};

const addWebhookSpecificFields = (
  credential,
  credentialChecks,
  { config: { identifyWebhookVersion } }
) => {
  if (identifyWebhookVersion === 2) {
    return {
      id: credential.id,
      credentialSchema: credential.credentialSchema,
      type: credential.type,
      credentialSubject: credential.credentialSubject,
      credentialChecks,
    };
  }
  return credential.credentialSubject; // credentialSubject hoisted in older versions. Remove by 01/01/2023
};

const extractValidUntil = (credential) =>
  credential?.credentialSubject?.validity?.validUntil ??
  credential?.credentialSubject?.validUntil ??
  credential?.validUntil ??
  credential?.expirationDate;

const extractValidFrom = (credential) =>
  credential?.credentialSubject?.validity?.validFrom ??
  credential?.credentialSubject?.validFrom ??
  credential?.validFrom;

module.exports = { buildIdentityDoc };
