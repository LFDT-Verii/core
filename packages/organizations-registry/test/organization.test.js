/**
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
 */

const {
  ServiceCategories,
  ServiceTypes,
  categorizeServices,
} = require('../index');
const { LegacyServiceTypes } = require('../src/legacy-service-types');

describe('categorizeServices', () => {
  it('should handle no services', () => {
    expect(categorizeServices([])).toEqual([]);
    expect(categorizeServices()).toEqual([]);
    expect(categorizeServices(null)).toEqual([]);
  });
  it('should handle one service category', () => {
    expect(categorizeServices([{ type: ServiceTypes.InspectionType }])).toEqual(
      [ServiceCategories.Inspector]
    );
    expect(
      categorizeServices([
        { type: ServiceTypes.InspectionType },
        { type: LegacyServiceTypes.InspectionTypeOld },
      ])
    ).toEqual([ServiceCategories.Inspector]);
  });
  it('should handle many services', () => {
    expect(
      categorizeServices([
        { type: ServiceTypes.InspectionType },
        { type: ServiceTypes.CareerIssuerType },
        { type: ServiceTypes.NotaryIssuerType },
        { type: ServiceTypes.CredentialAgentOperatorType },
        { type: LegacyServiceTypes.IssuerType },
      ])
    ).toEqual([
      ServiceCategories.Inspector,
      ServiceCategories.Issuer,
      ServiceCategories.NotaryIssuer,
      ServiceCategories.CredentialAgentOperator,
    ]);
  });
  it('should handle services with no type', () => {
    expect(
      categorizeServices([
        { type: ServiceTypes.InspectionType },
        {},
        { type: ServiceTypes.NotaryIssuerType },
      ])
    ).toEqual([ServiceCategories.Inspector, ServiceCategories.NotaryIssuer]);
  });
  it('should handle services with unknown type', () => {
    expect(
      categorizeServices([
        { type: ServiceTypes.InspectionType },
        { type: 'Fred' },
        { type: ServiceTypes.NotaryIssuerType },
      ])
    ).toEqual([ServiceCategories.Inspector, ServiceCategories.NotaryIssuer]);
  });
});
