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
 *
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const api = require('..');

describe('credentialing hub operator api', () => {
  it('should export the schemas with the $ids the Hub publishes', () => {
    expect({
      newIssuerServiceSchema: api.newIssuerServiceSchema.$id,
      issuerServiceSchema: api.issuerServiceSchema.$id,
      newDepotSchema: api.newDepotSchema.$id,
      depotSchema: api.depotSchema.$id,
      depotConflictErrorSchema: api.depotConflictErrorSchema.$id,
      findDepotsRequestSchema: api.findDepotsRequestSchema.$id,
      newCredentialSchema: api.newCredentialSchema.$id,
      credentialSchema: api.credentialSchema.$id,
      credentialItemsErrorSchema: api.credentialItemsErrorSchema.$id,
    }).toEqual({
      newIssuerServiceSchema: 'new-issuer-service',
      issuerServiceSchema: 'issuer-service',
      newDepotSchema: 'new-depot',
      depotSchema: 'depot',
      depotConflictErrorSchema: 'depot-conflict-error',
      findDepotsRequestSchema: 'find-depots-request',
      newCredentialSchema: 'new-credential',
      credentialSchema: 'Credential',
      credentialItemsErrorSchema: 'credential-items-error',
    });
  });

  // Clients map the Hub's errors with these, so changing one is a breaking change.
  it('should export the error codes', () => {
    expect(api.IssuerServicesErrors).toEqual({
      SERVICE_VP_AUTH_RULES_INVALID:
        'service_verifiablePresentationAuthRules_invalid',
    });
    expect(api.ServiceConfigurationErrors).toEqual({
      SERVICE_NOT_MATCHED: 'service_not_matched',
      SERVICE_NOT_FOUND: 'service_not_found',
      SERVICE_MUST_BE_UNIQUE: 'service_must_be_unique',
      RELATED_DEPOT_UNDELETED: 'related_depot_undeleted',
    });
    expect(api.DepotErrors).toEqual({
      REFERENCED_SERVICE_NOT_FOUND: 'referenced_service_not_found',
      RELATED_CREDENTIAL_UNDELETED: 'related_credential_undeleted',
      INVALID_AUTH_VALUES: 'invalid_auth_values',
      AUTH_VALUES_ALREADY_USED: 'auth_values_already_used',
      DEFERRED_CREDENTIALS_NOT_SUPPORTED: 'deferred_credentials_not_supported',
      DEPOT_NOT_FOUND: 'depot_not_found',
      AUTH_VALUES_FILTER_NOT_SUPPORTED: 'auth_values_filter_not_supported',
    });
    expect(api.CredentialErrors).toEqual({
      REFERENCED_DEPOT_NOT_FOUND: 'referenced_depot_not_found',
      CREDENTIAL_TYPE_NOT_FOUND: 'credential_type_not_found',
      CREDENTIAL_TYPE_NOT_EXPECTED: 'credential_type_not_expected',
      CREDENTIAL_TYPES_METADATA_UPSTREAM_ERROR:
        'credential_types_metadata_upstream_error',
      SCHEMA_UPSTREAM_ERROR: 'schema_upstream_error',
      REQUEST_VALIDATION_FAILED: 'request_validation_failed',
    });
  });

  it('should export the ObjectId pattern of the id filters', () => {
    expect(api.OBJECT_ID_PATTERN).toEqual('^[0-9a-fA-F]{24}$');
  });

  // Clients split loads by it, so lowering it is a breaking change.
  it('should export the credentials/create-many item limit', () => {
    expect(api.CREDENTIALS_CREATE_MANY_MAX_ITEMS).toEqual(1000);
  });

  it('should export the helpers', () => {
    expect(api).toEqual(
      expect.objectContaining({
        buildAuthMatchValues: expect.any(Function),
        initOperatorApiValidator: expect.any(Function),
        isOfValueType: expect.any(Function),
        isValidAuthValue: expect.any(Function),
        ruleValues: expect.any(Function),
        selectClaims: expect.any(Function),
        toAuthMatchValue: expect.any(Function),
      }),
    );
  });
});
