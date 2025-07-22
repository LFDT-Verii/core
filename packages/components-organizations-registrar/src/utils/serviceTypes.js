/**
 * Copyright 2023 Velocity Team
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

export const CREDENTIAL_TYPES_IDS = {
  VLC_CREDENTIAL_AGENT_OPERATOR: 'VlcCredentialAgentOperator_v1',
  VLC_INSPECTOR: 'VlcInspector_v1',
  VLC_CAREER_ISSUER: 'VlcCareerIssuer_v1',
  VLC_ID_DOCUMENT_ISSUER: 'VlcIdDocumentIssuer_v1',
  VLC_NOTARY_ISSUER: 'VlcNotaryIssuer_v1',
  VLC_NOTARY_ID_DOCUMENT_ISSUER: 'VlcNotaryIdDocumentIssuer_v1',
  VLC_NOTARY_CONTACT_ISSUER: 'VlcNotaryContactIssuer_v1',
  // VLC_HOLDER_APP_PROVIDER: 'VlcHolderAppProvider_v1',
  // VlcHolderAppProvider_v1 is hidden according comment
  // https://velocitycareerlabs.atlassian.net/browse/VL-6818?focusedCommentId=49600
  VLC_NODE_OPERATOR: 'VlcNodeOperator_v1',
  VLC_CONTACT_ISSUER_EMAIL: 'VlcContactIssuer_v1_email',
  VLC_CONTACT_ISSUER_PHONE: 'VlcContactIssuer_v1_phone',
};

const serviceTypes = [
  {
    title: 'Relying Party',
    id: CREDENTIAL_TYPES_IDS.VLC_INSPECTOR,
  },
  {
    title: 'Primary Source Career Issuer (eg. Employers & Educators)',
    id: CREDENTIAL_TYPES_IDS.VLC_CAREER_ISSUER,
  },
  {
    title: 'Primary Source Id Document Issuer (eg. Government Agency)',
    id: CREDENTIAL_TYPES_IDS.VLC_ID_DOCUMENT_ISSUER,
  },
  {
    title: 'Primary Source Phone Issuer (eg. Telco)',
    id: CREDENTIAL_TYPES_IDS.VLC_CONTACT_ISSUER_PHONE,
  },
  {
    title: 'Primary Source Email Issuer (eg. Email Service Provider)',
    id: CREDENTIAL_TYPES_IDS.VLC_CONTACT_ISSUER_EMAIL,
  },
  {
    title: 'Accredited Notary Career Issuer (eg. Background screeners)',
    id: CREDENTIAL_TYPES_IDS.VLC_NOTARY_ISSUER,
  },
  {
    title: 'Accredited Notary Phone/Email Issuer (eg. OTP Verifiers)',
    id: CREDENTIAL_TYPES_IDS.VLC_NOTARY_CONTACT_ISSUER,
  },
  {
    title: 'Accredited Notary Id Document Issuer (eg. IdV)',
    id: CREDENTIAL_TYPES_IDS.VLC_NOTARY_ID_DOCUMENT_ISSUER,
  },
  {
    title: 'Credential Agent Operator',
    id: CREDENTIAL_TYPES_IDS.VLC_CREDENTIAL_AGENT_OPERATOR,
  },
  // https://velocitycareerlabs.atlassian.net/browse/VL-6818?focusedCommentId=49600
  // VLC_HOLDER_APP_PROVIDER: 'VlcHolderAppProvider_v1',
  // {
  //   title: 'Wallet App Provider',
  //   id: CREDENTIAL_TYPES_IDS.VLC_HOLDER_APP_PROVIDER,
  // },
  {
    title: 'Node Operator',
    id: CREDENTIAL_TYPES_IDS.VLC_NODE_OPERATOR,
  },
];

export const serviceTypesIssuingOrInspection = [
  {
    title: 'Relying Party',
    id: CREDENTIAL_TYPES_IDS.VLC_INSPECTOR,
  },
  {
    title: 'Primary Source Career Issuer (eg. Employers & Educators)',
    id: CREDENTIAL_TYPES_IDS.VLC_CAREER_ISSUER,
  },
  {
    title: 'Primary Source Id Document Issuer (eg. Government Agency)',
    id: CREDENTIAL_TYPES_IDS.VLC_ID_DOCUMENT_ISSUER,
  },
  {
    title: 'Primary Source Phone Issuer (eg. Telco)',
    id: CREDENTIAL_TYPES_IDS.VLC_CONTACT_ISSUER_PHONE,
  },
  {
    title: 'Primary Source Email Issuer (eg. Email Service Provider)',
    id: CREDENTIAL_TYPES_IDS.VLC_CONTACT_ISSUER_EMAIL,
  },
  {
    title: 'Accredited Notary Career Issuer (eg. Background screeners)',
    id: CREDENTIAL_TYPES_IDS.VLC_NOTARY_ISSUER,
  },

  {
    title: 'Accredited Notary Phone/Email Issuer (eg. OTP Verifiers)',
    id: CREDENTIAL_TYPES_IDS.VLC_NOTARY_CONTACT_ISSUER,
  },

  {
    title: 'Accredited Notary Id Document Issuer (eg. IdV)',
    id: CREDENTIAL_TYPES_IDS.VLC_NOTARY_ID_DOCUMENT_ISSUER,
  },
];

const commonCredentialTypes = [
  'EducationDegreeRegistrationV1.1',
  'EducationDegreeStudyV1.1',
  'EducationDegreeGraduationV1.1',
  'EmploymentCurrentV1.1',
  'EmploymentPastV1.1',
  'CertificationV1.1',
  'LicenseV1.1',
  'CourseRegistrationV1.1',
  'CourseCompletionV1.1',
  'CourseAttendanceV1.1',
  'AssessmentV1.1',
  'BadgeV1.1',
  'OpenBadgeV2.0',
  'OpenBadgeCredential',
];

export const credentialTypesByServiceTypes = {
  [CREDENTIAL_TYPES_IDS.VLC_ID_DOCUMENT_ISSUER]: [
    'IdDocumentV1.0',
    'DriversLicenseV1.0',
    'NationalIdCardV1.0',
    'PassportV1.0',
    'ResidentPermitV1.0',
    'ProofOfAgeV1.0',
  ],
  [CREDENTIAL_TYPES_IDS.VLC_NOTARY_ID_DOCUMENT_ISSUER]: [
    'IdDocumentV1.0',
    'DriversLicenseV1.0',
    'NationalIdCardV1.0',
    'PassportV1.0',
    'ResidentPermitV1.0',
    'ProofOfAgeV1.0',
  ],
  [CREDENTIAL_TYPES_IDS.VLC_CONTACT_ISSUER_EMAIL]: ['EmailV1.0'],
  [CREDENTIAL_TYPES_IDS.VLC_CONTACT_ISSUER_PHONE]: ['PhoneV1.0'],
  [CREDENTIAL_TYPES_IDS.VLC_CAREER_ISSUER]: commonCredentialTypes,
  [CREDENTIAL_TYPES_IDS.VLC_NOTARY_ISSUER]: commonCredentialTypes,
  [CREDENTIAL_TYPES_IDS.VLC_NOTARY_CONTACT_ISSUER]: ['EmailV1.0', 'PhoneV1.0'],
};

export const serviceTypeTitlesMap = serviceTypes.reduce((acc, item) => {
  acc[item.id] = item.title;
  return acc;
}, {});

export default serviceTypes;
