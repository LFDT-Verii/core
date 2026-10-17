/*
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

const {
  CredentialDataModelVersions,
  CredentialEnvelopeFormats,
  VersionAlgorithmAllowlists,
  decodeCredentialEnvelope,
} = require('@verii/jwt');

const credentialEnvelopeMetadataKeys = [
  'dataModelVersion',
  'envelopeFormat',
  'signingAlgorithm',
];

const buildIssuedCredentialEnvelope = (issuedCredential) => {
  assertIssuedCredential(issuedCredential);
  const {
    credentialFormat: envelopeFormat,
    credentialId: credentialDid,
    credentialStatus,
    dataModelVersion,
    securedCredential: jwtVc,
    securingMechanism: { algorithm: signingAlgorithm },
  } = issuedCredential;

  return {
    credentialDid,
    credentialStatus,
    dataModelVersion,
    envelopeFormat,
    jwtVc,
    signingAlgorithm,
  };
};

const assertIssuedCredential = (issuedCredential) => {
  const {
    credentialFormat,
    credentialId,
    dataModelVersion,
    securedCredential,
    securingMechanism,
  } = issuedCredential ?? {};
  assertNonEmptyString(
    credentialId,
    'Issued credential envelope is missing credential id',
  );
  assertNonEmptyString(
    securedCredential,
    'Issued credential envelope is missing secured credential',
  );
  assertSupportedDataModelVersion(dataModelVersion);
  assertSupportedCredentialFormat(credentialFormat);
  assertSupportedSecuringMechanism(dataModelVersion, securingMechanism);
};

const assertSupportedCredentialFormat = (credentialFormat) => {
  if (!Object.values(CredentialEnvelopeFormats).includes(credentialFormat)) {
    throw new Error('Issued credential has an unsupported format');
  }
};

const assertSupportedDataModelVersion = (dataModelVersion) => {
  if (!Object.values(CredentialDataModelVersions).includes(dataModelVersion)) {
    throw new Error('Issued credential has an unsupported data model version');
  }
};

const assertSupportedSecuringMechanism = (
  dataModelVersion,
  securingMechanism,
) => {
  if (
    securingMechanism?.type !== 'jose' ||
    !VersionAlgorithmAllowlists[dataModelVersion].includes(
      securingMechanism.algorithm,
    )
  ) {
    throw new Error('Issued credential has an unsupported securing mechanism');
  }
};

const assertNonEmptyString = (value, errorMessage) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(errorMessage);
  }
};

const inferCredentialEnvelopeMetadata = (credential) => {
  if (credential == null || hasCredentialEnvelopeMetadata(credential)) {
    return credential;
  }
  if (credential.jwtVc == null) {
    return omitUnavailableCredentialEnvelopeMetadata(credential);
  }

  try {
    const envelope = decodeCredentialEnvelope(credential.jwtVc);
    const metadata = buildCredentialEnvelopeMetadata(envelope);

    return mergeCredentialEnvelopeMetadata(credential, metadata);
  } catch {
    // Pre-migration records must remain readable even if their compact value
    // cannot be classified by the stricter shared codec.
    return omitUnavailableCredentialEnvelopeMetadata(credential);
  }
};

const buildCredentialEnvelopeMetadata = (envelope) => ({
  dataModelVersion: envelope.dataModelVersion,
  envelopeFormat: envelope.envelopeFormat,
  signingAlgorithm: envelope.protectedHeader.alg,
});

const hasCredentialEnvelopeMetadata = ({
  dataModelVersion,
  envelopeFormat,
  signingAlgorithm,
}) =>
  dataModelVersion != null &&
  envelopeFormat != null &&
  signingAlgorithm != null;

const mergeCredentialEnvelopeMetadata = (credential, metadata) => ({
  ...credential,
  dataModelVersion: credential.dataModelVersion ?? metadata.dataModelVersion,
  envelopeFormat: credential.envelopeFormat ?? metadata.envelopeFormat,
  signingAlgorithm: credential.signingAlgorithm ?? metadata.signingAlgorithm,
});

const omitUnavailableCredentialEnvelopeMetadata = (credential) => {
  const normalizedCredential = { ...credential };

  for (const key of credentialEnvelopeMetadataKeys) {
    if (normalizedCredential[key] == null) {
      delete normalizedCredential[key];
    }
  }

  return normalizedCredential;
};

module.exports = {
  buildIssuedCredentialEnvelope,
  inferCredentialEnvelopeMetadata,
};
