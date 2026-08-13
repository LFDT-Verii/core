/*
 * Copyright 2024 Velocity Team
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

const newError = require('http-errors');
const { CredentialCheckResultValue } = require('./constants');

const checkFailedMessage = (reason, id, value) => {
  const credentialReference = id === undefined ? '' : ` for credential ${id}`;
  return `${reason} credential check failed${credentialReference}. Was '${value}', expected 'PASS'`;
};

const credentialIdFrom = ({ id } = {}) => id;

const isTamperingFailure = (credential, credentialChecks) =>
  credential === undefined ||
  credentialChecks.UNTAMPERED !== CredentialCheckResultValue.PASS;

const buildFailedCheckResultError = (
  { credential, credentialChecks },
  { log },
) => {
  const credentialId = credentialIdFrom(credential);
  if (isTamperingFailure(credential, credentialChecks)) {
    log.error(
      checkFailedMessage('tampered', credentialId, credentialChecks.UNTAMPERED),
    );
    return newError(401, 'presentation_credential_tampered', {
      errorCode: 'presentation_credential_failed_tampered',
    });
  }
  if (credentialChecks.TRUSTED_ISSUER !== CredentialCheckResultValue.PASS) {
    log.error(
      checkFailedMessage(
        'trusted_issuer',
        credentialId,
        credentialChecks.TRUSTED_ISSUER,
      ),
    );
    return newError(401, 'presentation_credential_bad_issuer', {
      errorCode: 'presentation_credential_bad_issuer',
    });
  }
  if (credentialChecks.UNREVOKED !== CredentialCheckResultValue.PASS) {
    log.error(
      checkFailedMessage('revoked', credentialId, credentialChecks.UNREVOKED),
    );
    return newError(401, 'presentation_credential_revoked', {
      errorCode: 'presentation_credential_revoked',
    });
  }
  if (
    ![
      CredentialCheckResultValue.PASS,
      CredentialCheckResultValue.NOT_APPLICABLE,
    ].includes(credentialChecks.UNEXPIRED)
  ) {
    log.error(
      checkFailedMessage('expired', credentialId, credentialChecks.UNEXPIRED, [
        CredentialCheckResultValue.NOT_APPLICABLE,
      ]),
    );
    return newError(401, 'presentation_credential_expired', {
      errorCode: 'presentation_credential_expired',
    });
  }
  if (
    ![
      CredentialCheckResultValue.PASS,
      CredentialCheckResultValue.NOT_APPLICABLE,
    ].includes(credentialChecks.TRUSTED_HOLDER)
  ) {
    log.error(
      checkFailedMessage(
        'trusted_holder',
        credentialId,
        credentialChecks.TRUSTED_HOLDER,
        [CredentialCheckResultValue.NOT_APPLICABLE],
      ),
    );
    return newError(401, 'presentation_credential_bad_holder', {
      errorCode: 'presentation_credential_bad_holder',
    });
  }

  return undefined;
};

module.exports = { buildFailedCheckResultError };
