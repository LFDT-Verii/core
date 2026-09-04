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

const FINERACT_EXTERNAL_ID_MAX_LENGTH = 100;

// Fineract clients and accounts provisioned before the registrar switched to
// Mongo organization IDs carry the organization DID as their external ID,
// with the same "#escrow-account" / "#stakes-account" suffixes.
const REGISTRAR_ORGANIZATION_PREFIX = 'registrar:org:';

const buildFineractExternalId = (organizationId, relativeId = '') => {
  if (organizationId == null) {
    throw new Error(
      'organizationId is required to build a Fineract external ID',
    );
  }
  const externalId = `${REGISTRAR_ORGANIZATION_PREFIX}${organizationId}${relativeId}`;
  if (externalId.length > FINERACT_EXTERNAL_ID_MAX_LENGTH) {
    throw new Error(
      `Fineract external ID exceeds ${FINERACT_EXTERNAL_ID_MAX_LENGTH} characters: ${externalId}`,
    );
  }
  return externalId;
};

module.exports = { FINERACT_EXTERNAL_ID_MAX_LENGTH, buildFineractExternalId };
