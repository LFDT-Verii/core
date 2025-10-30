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

const { includes, startsWith } = require('lodash/fp');
const { ServiceCategories } = require('@verii/organizations-registry');
const { checkIdentityIssuer } = require('./check-identity-issuer');
const { verifyPrimarySourceIssuer } = require('./verify-primary-source-issuer');

const verifyIssuerForCredentialType = (
  credential,
  issuerId,
  { issuerAccreditation, credentialTypeMetadata },
  { log, config }
) => {
  const { permittedVelocityServiceCategory } = issuerAccreditation;

  if (
    [
      ServiceCategories.IdentityIssuer,
      ServiceCategories.IdDocumentIssuer,
      ServiceCategories.ContactIssuer,
    ].includes(credentialTypeMetadata.issuerCategory)
  ) {
    return checkIdentityIssuer(permittedVelocityServiceCategory);
  }

  if (startsWith('Notary', permittedVelocityServiceCategory)) {
    return true;
  }

  if (includes(ServiceCategories.Issuer, permittedVelocityServiceCategory)) {
    return verifyPrimarySourceIssuer(
      { credential, issuerId, credentialTypeMetadata },
      { log, config }
    );
  }

  throw new Error('issuer_requires_notary_or_issuer_permission');
};

module.exports = {
  verifyIssuerForCredentialType,
};
