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
  decodeCredentialEnvelope,
  getCredentialId,
  getCredentialStatus,
} = require('@verii/jwt');

const buildIssuedCredentialEnvelope = (jwtVc) => {
  const envelope = decodeCredentialEnvelope(jwtVc);
  const credentialDid = getCredentialId(envelope);
  const metadata = buildCredentialEnvelopeMetadata(envelope);

  if (typeof credentialDid !== 'string' || credentialDid.length === 0) {
    throw new Error('Issued credential envelope is missing credential id');
  }

  return {
    credentialDid,
    credentialStatus: getCredentialStatus(envelope),
    jwtVc,
    ...metadata,
  };
};

const inferCredentialEnvelopeMetadata = (credential) => {
  if (credential?.jwtVc == null || hasCredentialEnvelopeMetadata(credential)) {
    return credential;
  }

  try {
    const envelope = decodeCredentialEnvelope(credential.jwtVc);
    const metadata = buildCredentialEnvelopeMetadata(envelope);

    return mergeCredentialEnvelopeMetadata(credential, metadata);
  } catch {
    // Pre-migration records must remain readable even if their compact value
    // cannot be classified by the stricter shared codec.
    return credential;
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

module.exports = {
  buildIssuedCredentialEnvelope,
  inferCredentialEnvelopeMetadata,
};
