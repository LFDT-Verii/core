import {
    VCLCredentialType,
    VCLCredentialTypes,
    VCLError,
} from '../../../../src';
import CredentialTypesModel from '../../../../src/impl/domain/models/CredentialTypesModel';

export class CredentialTypesModelMock implements CredentialTypesModel {
    constructor(private issuerCategory: string) {}

    mockedData = VCLCredentialTypes.fromPayload(
        CredentialTypesModelMock.Payload
    );

    get data(): VCLCredentialTypes {
        return this.mockedData;
    }

    initialize(): Promise<VCLError> {
        throw new Error('Method not implemented.');
    }

    credentialTypeByTypeName = (type: string): VCLCredentialType => {
        return new VCLCredentialType({}, this.issuerCategory);
    };

    static IssuerCategoryNotaryIssuer = 'NotaryIssuer';

    static IssuerCategoryRegularIssuer = 'RegularIssuer';

    //        Identity issuer categories:
    static IssuerCategoryIdentityIssuer = 'IdentityIssuer';

    static IssuerCategoryIdDocumentIssuer = 'IdDocumentIssuer';

    static IssuerCategoryNotaryIdDocumentIssuer = 'NotaryIdDocumentIssuer';

    static IssuerCategoryContactIssuer = 'ContactIssuer';

    static IssuerCategoryNotaryContactIssuer = 'NotaryContactIssuer';

    static Payload = [
        {
            credentialType: 'NCSBNMultiLicenseV1.0',
            credentialGroup: 'Career',
            schemaName: 'ncsbn-multi-license-v1.0',
            recommended: false,
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: false,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/PRimc-IFALa8IrR0bxrzb-NCSBNMultiLicenseV1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/HSd0MuPcXb577URMM8vp4-NCSBNMultiLicenseV1.0.descriptor.json',
            },
            id: '65e9bc5d9e98fe15dab8bb07',
            createdAt: '2024-03-07T13:08:45.139Z',
            updatedAt: '2024-03-07T13:08:45.139Z',
        },
        {
            credentialType: 'TestV1.1',
            credentialGroup: 'IdDocument',
            schemaName: 'test-v1.1.json',
            recommended: false,
            linkedinProfileCompatible: false,
            jsonldContext: ['https://www.schema.com'],
            issuerCategory: 'IdDocumentIssuer',
            layer1: true,
            schemaUrl:
                'https://qalib.velocitynetwork.foundation/schemas/Im7NwaSpjb5dhLsgQy2gi-test-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://qalib.velocitynetwork.foundation/display-descriptors/mO7wiFymgF2pZLaK9357o-test-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://qalib.velocitynetwork.foundation/form-schemas/VrHkv65XvYk7DoZrBpD9p-test-v1.1.form-schema.json',
            },
            id: '65d5ec79d4775aa694443b3b',
            createdAt: '2024-02-21T12:28:41.751Z',
            updatedAt: '2024-02-21T12:28:41.751Z',
        },
        {
            credentialType: 'NCSBNMultiLicenseV1.0',
            credentialGroup: 'Career',
            schemaName: 'ncsbn-multi-license-v1.0',
            recommended: false,
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: false,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/-pSSfnBFYh1J9pGeTt5Hk-NCSBNMultiLicenseV1.0.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/Rrm0AOND2DbhN8UafP0Xt-NCSBNMultiLicenseV1.0.descriptor.json',
            },
            id: '65d4b6f9a0573f3d130a6c51',
            createdAt: '2024-02-20T14:28:09.764Z',
            updatedAt: '2024-02-20T14:28:09.764Z',
        },
        {
            credentialType: 'EducationDegreeGraduationV1.0',
            credentialGroup: 'Career',
            schemaName: 'education-degree-graduation-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/education-degree-graduation-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/education-degree-graduation-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EducationDegreeGraduationV1.0.form-schema.json',
            },
            id: '644e1d3dbb302308ea73539d',
            createdAt: '2023-04-30T07:48:13.076Z',
            updatedAt: '2023-04-30T07:48:13.076Z',
        },
        {
            credentialType: 'OpenBadgeCredential',
            credentialGroup: 'Career',
            schemaName: 'open-badge-credential',
            recommended: false,
            linkedIn: {
                shareInProfile: true,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/open-badge-credential.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/open-badge-credential.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/OpenBadgeCredential.form-schema.json',
            },
            id: '629e033ed91f177d0ecc22b6',
            createdAt: '2022-06-06T13:38:06.595Z',
            updatedAt: '2022-06-06T13:38:06.595Z',
        },
        {
            credentialType: 'EducationDegree',
            credentialGroup: 'Career',
            schemaName: 'education-degree',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/education-degree.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/education-degree.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EducationDegree.form-schema.json',
            },
            id: '5fe4a315d8b45dd2e80bd739',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.633Z',
        },
        {
            credentialType: 'CurrentEmploymentPosition',
            credentialGroup: 'Career',
            schemaName: 'current-employment-position',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/current-employment-position.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/current-employment-position.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CurrentEmploymentPosition.form-schema.json',
            },
            id: '5fe4a315d8b45dd2e80bd73a',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.632Z',
        },
        {
            credentialType: 'PastEmploymentPosition',
            credentialGroup: 'Career',
            schemaName: 'past-employment-position',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/past-employment-position.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/past-employment-position.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/PastEmploymentPosition.form-schema.json',
            },
            id: '5fe4a315d8b45dd2e80bd73b',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.643Z',
        },
        {
            credentialType: 'Badge',
            credentialGroup: 'Career',
            schemaName: 'badge',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/badge.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/badge.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/Badge.form-schema.json',
            },
            id: '5fe4a315d8b45dd2e80bd73c',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.632Z',
        },
        {
            credentialType: 'Certification',
            credentialGroup: 'Career',
            schemaName: 'certification',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/certification.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/certification.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/Certification.form-schema.json',
            },
            id: '5fe4a315d8b45dd2e80bd73d',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.640Z',
        },
        {
            credentialType: 'Course',
            credentialGroup: 'Career',
            schemaName: 'course',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/course.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/course.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/Course.form-schema.json',
            },
            id: '5fe4a315d8b45dd2e80bd73e',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.632Z',
        },
        {
            credentialType: 'Assessment',
            credentialGroup: 'Career',
            schemaName: 'assessment',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/assessment.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/assessment.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/Assessment.form-schema.json',
            },
            id: '5fe4a315d8b45dd2e80bd73f',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.634Z',
        },
        {
            credentialType: 'Email',
            credentialGroup: 'Career',
            schemaName: 'email',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'ContactIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/email.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/email.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/Email.form-schema.json',
            },
            id: '5fedc9352ceb53ba87103b31',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.641Z',
        },
        {
            credentialType: 'Phone',
            credentialGroup: 'Career',
            schemaName: 'phone',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'ContactIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/phone.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/phone.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/Phone.form-schema.json',
            },
            id: '5fedc9912ceb53ba871066ee',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.631Z',
        },
        {
            credentialType: 'IdDocument',
            credentialGroup: 'Career',
            schemaName: 'id-document',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            issuerCategory: 'IdDocumentIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/id-document.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/id-document.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/IdDocument.form-schema.json',
            },
            id: '5fedca322ceb53ba8710b292',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.640Z',
        },
        {
            credentialType: 'CourseRegistrationV1.0',
            credentialGroup: 'Career',
            schemaName: 'course-registration-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/course-registration-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/course-registration-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CourseRegistrationV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e42',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.642Z',
        },
        {
            credentialType: 'CourseCompletionV1.0',
            credentialGroup: 'Career',
            schemaName: 'course-completion-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/course-completion-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/course-completion-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CourseCompletionV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e43',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.636Z',
        },
        {
            credentialType: 'CourseAttendanceV1.0',
            credentialGroup: 'Career',
            schemaName: 'course-attendance-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/course-attendance-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/course-attendance-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CourseAttendanceV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e44',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.641Z',
        },
        {
            credentialType: 'EducationDegreeRegistrationV1.0',
            credentialGroup: 'Career',
            schemaName: 'education-degree-registration-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/education-degree-registration-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/education-degree-registration-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EducationDegreeRegistrationV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e45',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.637Z',
        },
        {
            credentialType: 'EducationDegreeStudyV1.0',
            credentialGroup: 'Career',
            schemaName: 'education-degree-study-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/education-degree-study-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/education-degree-study-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EducationDegreeStudyV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e46',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.644Z',
        },
        {
            credentialType: 'CertificationV1.0',
            credentialGroup: 'Career',
            schemaName: 'certification-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: true,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/certification-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/certification-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CertificationV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e48',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.643Z',
        },
        {
            credentialType: 'IdDocumentV1.0',
            credentialGroup: 'IdDocument',
            schemaName: 'id-document-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'IdDocumentIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/id-document-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/id-document-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/IdDocumentV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e49',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.639Z',
        },
        {
            credentialType: 'LicenseV1.0',
            credentialGroup: 'Career',
            schemaName: 'license-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: true,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/license-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/license-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/LicenseV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e4a',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.634Z',
        },
        {
            credentialType: 'DriversLicenseV1.0',
            credentialGroup: 'IdDocument',
            schemaName: 'drivers-license-v1.0',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'IdDocumentIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/drivers-license-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/drivers-license-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/DriversLicenseV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e4b',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-06-06T13:38:05.105Z',
        },
        {
            credentialType: 'NationalIdCardV1.0',
            credentialGroup: 'IdDocument',
            schemaName: 'national-id-card-v1.0',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'IdDocumentIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/national-id-card-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/national-id-card-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/NationalIdCardV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e4c',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-06-06T13:38:05.105Z',
        },
        {
            credentialType: 'PassportV1.0',
            credentialGroup: 'IdDocument',
            schemaName: 'passport-v1.0',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'IdDocumentIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/passport-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/passport-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/PassportV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e4d',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-06-06T13:38:05.105Z',
        },
        {
            credentialType: 'ResidentPermitV1.0',
            credentialGroup: 'IdDocument',
            schemaName: 'resident-permit-v1.0',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'IdDocumentIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/resident-permit-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/resident-permit-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/ResidentPermitV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e4e',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-06-06T13:38:05.105Z',
        },
        {
            credentialType: 'OpenBadgeV1.0',
            credentialGroup: 'Career',
            schemaName: 'open-badge-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/open-badge-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/open-badge-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/OpenBadgeV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e4f',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.638Z',
        },
        {
            credentialType: 'AssessmentV1.0',
            credentialGroup: 'Career',
            schemaName: 'assessment-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/assessment-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/assessment-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/AssessmentV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e50',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.633Z',
        },
        {
            credentialType: 'EmploymentCurrentV1.0',
            credentialGroup: 'Career',
            schemaName: 'employment-current-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/employment-current-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/employment-current-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EmploymentCurrentV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e51',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.639Z',
        },
        {
            credentialType: 'EmploymentPastV1.0',
            credentialGroup: 'Career',
            schemaName: 'employment-past-v1.0',
            recommended: false,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/employment-past-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/employment-past-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EmploymentPastV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e52',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.637Z',
        },
        {
            credentialType: 'EmailV1.0',
            credentialGroup: 'Contact',
            schemaName: 'email-v1.0',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'ContactIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/email-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/email-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EmailV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e53',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-06-06T13:38:05.105Z',
        },
        {
            credentialType: 'PhoneV1.0',
            credentialGroup: 'Contact',
            schemaName: 'phone-v1.0',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'ContactIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/phone-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/phone-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/PhoneV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e54',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-06-06T13:38:05.105Z',
        },
        {
            credentialType: 'ProofOfAgeV1.0',
            credentialGroup: 'IdDocument',
            schemaName: 'proof-of-age-v1.0',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: false,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.0.jsonld.json',
            ],
            issuerCategory: 'IdDocumentIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/proof-of-age-v1.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/proof-of-age-v1.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/ProofOfAgeV1.0.form-schema.json',
            },
            id: '618d1caff7d8914e84703e56',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-06-06T13:38:05.105Z',
        },
        {
            credentialType: 'CourseRegistrationV1.1',
            credentialGroup: 'Career',
            schemaName: 'course-registration-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/course-registration-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/course-registration-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CourseRegistrationV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b11',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.643Z',
        },
        {
            credentialType: 'CourseCompletionV1.1',
            credentialGroup: 'Career',
            schemaName: 'course-completion-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/course-completion-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/course-completion-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CourseCompletionV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b12',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.644Z',
        },
        {
            credentialType: 'CourseAttendanceV1.1',
            credentialGroup: 'Career',
            schemaName: 'course-attendance-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/course-attendance-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/course-attendance-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CourseAttendanceV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b13',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.645Z',
        },
        {
            credentialType: 'EducationDegreeRegistrationV1.1',
            credentialGroup: 'Career',
            schemaName: 'education-degree-registration-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/education-degree-registration-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/education-degree-registration-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EducationDegreeRegistrationV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b14',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.645Z',
        },
        {
            credentialType: 'EducationDegreeStudyV1.1',
            credentialGroup: 'Career',
            schemaName: 'education-degree-study-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/education-degree-study-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/education-degree-study-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EducationDegreeStudyV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b15',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.646Z',
        },
        {
            credentialType: 'EducationDegreeGraduationV1.1',
            credentialGroup: 'Career',
            schemaName: 'education-degree-graduation-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/education-degree-graduation-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/education-degree-graduation-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EducationDegreeGraduationV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b16',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.646Z',
        },
        {
            credentialType: 'CertificationV1.1',
            credentialGroup: 'Career',
            schemaName: 'certification-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: true,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/certification-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/certification-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/CertificationV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b17',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.647Z',
        },
        {
            credentialType: 'LicenseV1.1',
            credentialGroup: 'Career',
            schemaName: 'license-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: true,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/license-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/license-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/LicenseV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b19',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.646Z',
        },
        {
            credentialType: 'AssessmentV1.1',
            credentialGroup: 'Career',
            schemaName: 'assessment-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/assessment-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/assessment-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/AssessmentV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b1f',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.648Z',
        },
        {
            credentialType: 'EmploymentCurrentV1.1',
            credentialGroup: 'Career',
            schemaName: 'employment-current-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/employment-current-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/employment-current-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EmploymentCurrentV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b20',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.647Z',
        },
        {
            credentialType: 'EmploymentPastV1.1',
            credentialGroup: 'Career',
            schemaName: 'employment-past-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: false,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/employment-past-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/employment-past-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/EmploymentPastV1.1.form-schema.json',
            },
            id: '6220c47998fdb468aecc2b21',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.647Z',
        },
        {
            credentialType: 'BadgeV1.1',
            credentialGroup: 'Career',
            schemaName: 'badge-v1.1',
            recommended: true,
            linkedIn: {
                shareInProfile: true,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/badge-v1.1.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/badge-v1.1.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/BadgeV1.1.form-schema.json',
            },
            id: '6225e2658ae3923abbbbf710',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.647Z',
        },
        {
            credentialType: 'OpenBadgeV2.0',
            credentialGroup: 'Career',
            schemaName: 'open-badge-v2.0',
            recommended: false,
            linkedIn: {
                shareInProfile: true,
                shareInFeed: true,
            },
            linkedinProfileCompatible: false,
            jsonldContext: [
                'https://staginglib.velocitynetwork.foundation/contexts/layer1-v1.1.jsonld.json',
            ],
            issuerCategory: 'RegularIssuer',
            layer1: true,
            schemaUrl:
                'https://staginglib.velocitynetwork.foundation/schemas/open-badge-v2.0.schema.json',
            displayDescriptorUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/display-descriptors/en/open-badge-v2.0.descriptor.json',
            },
            formSchemaUrls: {
                en: 'https://staginglib.velocitynetwork.foundation/form-schemas/en/OpenBadgeV2.0.form-schema.json',
            },
            id: '6225e2658ae3923abbbbf716',
            createdAt: '2022-03-30T10:24:55.010Z',
            updatedAt: '2022-04-26T08:09:34.648Z',
        },
    ];
}
