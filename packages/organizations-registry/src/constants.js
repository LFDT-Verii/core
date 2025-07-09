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

const { flow, flatMap, fromPairs, map, toPairs } = require('lodash/fp');
const { LegacyServiceTypes } = require('./legacy-service-types');

const ServiceTypes = {
  InspectionType: 'VlcInspector_v1',
  NotaryIssuerType: 'VlcNotaryIssuer_v1',
  HolderAppProviderType: 'VlcHolderAppProvider_v1',
  WebWalletProviderType: 'VlcWebWalletProvider_v1',
  NodeOperatorType: 'VlcNodeOperator_v1',
  CredentialAgentOperatorType: 'VlcCredentialAgentOperator_v1',
  CareerIssuerType: 'VlcCareerIssuer_v1',
  IdDocumentIssuerType: 'VlcIdDocumentIssuer_v1',
  NotaryIdDocumentIssuerType: 'VlcNotaryIdDocumentIssuer_v1',
  ContactIssuerType: 'VlcContactIssuer_v1',
  NotaryContactIssuerType: 'VlcNotaryContactIssuer_v1',
  IdentityIssuerType: 'VlcIdentityIssuer_v1',
};

const ServiceCategories = {
  CredentialAgentOperator: 'CredentialAgentOperator',
  HolderAppProvider: 'HolderAppProvider',
  Inspector: 'Inspector',
  Issuer: 'Issuer',
  NodeOperator: 'NodeOperator',
  NotaryIssuer: 'NotaryIssuer',
  TrustRoot: 'TrustRoot',
  IdDocumentIssuer: 'IdDocumentIssuer',
  NotaryIdDocumentIssuer: 'NotaryIdDocumentIssuer',
  ContactIssuer: 'ContactIssuer',
  NotaryContactIssuer: 'NotaryContactIssuer',
  IdentityIssuer: 'IdentityIssuer',
};

const ServiceTypesOfServiceCategory = {
  [ServiceCategories.CredentialAgentOperator]: [
    LegacyServiceTypes.ServiceProviderType,
    ServiceTypes.CredentialAgentOperatorType,
  ],
  [ServiceCategories.HolderAppProvider]: [
    ServiceTypes.HolderAppProviderType,
    ServiceTypes.WebWalletProviderType,
  ],
  [ServiceCategories.Inspector]: [
    ServiceTypes.InspectionType,
    LegacyServiceTypes.InspectionTypeOld,
  ],
  [ServiceCategories.Issuer]: [
    LegacyServiceTypes.IssuerType,
    ServiceTypes.CareerIssuerType,
  ],
  [ServiceCategories.NodeOperator]: [ServiceTypes.NodeOperatorType],
  [ServiceCategories.NotaryIssuer]: [ServiceTypes.NotaryIssuerType],
  [ServiceCategories.TrustRoot]: [],
  [ServiceCategories.IdDocumentIssuer]: [ServiceTypes.IdDocumentIssuerType],
  [ServiceCategories.NotaryIdDocumentIssuer]: [
    ServiceTypes.NotaryIdDocumentIssuerType,
  ],
  [ServiceCategories.ContactIssuer]: [ServiceTypes.ContactIssuerType],
  [ServiceCategories.NotaryContactIssuer]: [
    ServiceTypes.NotaryContactIssuerType,
  ],
  [ServiceCategories.IdentityIssuer]: [ServiceTypes.IdentityIssuerType],
};

const IssuingAndInspectionCategories = [
  ServiceCategories.Issuer,
  ServiceCategories.NotaryIssuer,
  ServiceCategories.IdentityIssuer,
  ServiceCategories.IdDocumentIssuer,
  ServiceCategories.NotaryIdDocumentIssuer,
  ServiceCategories.ContactIssuer,
  ServiceCategories.NotaryContactIssuer,
  ServiceCategories.Inspector,
];

const ServiceTypeToCategoryMap = flow(
  toPairs,
  flatMap(([category, types]) => map((type) => [type, category], types)),
  fromPairs
)(ServiceTypesOfServiceCategory);

const OrganizationDidDocErrorMessages = {
  SERVICE_ID_ALREADY_EXISTS: 'Service id already exists',
};

const OrganizationRegistryErrorMessages = {
  ...OrganizationDidDocErrorMessages,
};

const IonPublicKeyPurpose = {
  Authentication: 'authentication',
  AssertionMethod: 'assertionMethod',
  CapabilityInvocation: 'capabilityInvocation',
  CapabilityDelegation: 'capabilityDelegation',
  KeyAgreement: 'keyAgreement',
};

module.exports = {
  IssuingAndInspectionCategories,
  ServiceTypes,
  ServiceCategories,
  ServiceTypesOfServiceCategory,
  ServiceTypeToCategoryMap,
  OrganizationRegistryErrorMessages,
  IonPublicKeyPurpose,
};
