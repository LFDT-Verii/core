import { describe, test } from 'node:test';
import { expect } from 'expect';
import { CredentialTypesMocks } from '../infrastructure/resources/valid/CredentialTypesMocks';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import CredentialTypesRepositoryImpl from '../../src/impl/data/repositories/CredentialTypesRepositoryImpl';
import CredentialTypesUseCaseImpl from '../../src/impl/data/usecases/CredentialTypesUseCaseImpl';
import { VCLCredentialType, VCLErrorCode } from '../../src';

describe('CredentialTypesUseCaseImpl Tests', () => {
    const subject1 = new CredentialTypesUseCaseImpl(
        new CredentialTypesRepositoryImpl(
            new NetworkServiceSuccess(
                JSON.parse(CredentialTypesMocks.CredentialTypesJsonStr)
            )
        )
    );
    const subject2 = new CredentialTypesUseCaseImpl(
        new CredentialTypesRepositoryImpl(
            new NetworkServiceSuccess({ wrong: 'payload' })
        )
    );

    test('testGetCountriesSuccess', async () => {
        const credentialTypes = await subject1.getCredentialTypes();

        compareCredentialTypes(
            credentialTypes.all!,
            getExpectedCredentialTypesArr()
        );
        compareCredentialTypes(
            credentialTypes.recommendedTypes!,
            getExpectedRecommendedCredentialTypesArr()
        );
    });

    test('testGetCountriesFailure', async () => {
        try {
            await subject2.getCredentialTypes();
            expect(false).toEqual(true);
        } catch (error: any) {
            expect(error.errorCode).toEqual(VCLErrorCode.SdkError.toString());
        }
    });

    const compareCredentialTypes = (
        credentialTypesArr1: VCLCredentialType[],
        credentialTypesArr2: VCLCredentialType[]
    ) => {
        for (let i = 0; i < credentialTypesArr1.length; i++) {
            expect(credentialTypesArr1[i].payload).toStrictEqual(
                credentialTypesArr2[i].payload
            );
            expect(credentialTypesArr1[i].id).toEqual(
                credentialTypesArr2[i].id
            );
            expect(credentialTypesArr1[i].schema).toEqual(
                credentialTypesArr2[i].schema
            );
            expect(credentialTypesArr1[i].createdAt).toEqual(
                credentialTypesArr2[i].createdAt
            );
            expect(credentialTypesArr1[i].schemaName).toEqual(
                credentialTypesArr2[i].schemaName
            );
            expect(credentialTypesArr1[i].credentialType).toEqual(
                credentialTypesArr2[i].credentialType
            );
            expect(credentialTypesArr1[i].recommended).toEqual(
                credentialTypesArr2[i].recommended
            );
        }
    };

    const getExpectedCredentialTypesArr = (): VCLCredentialType[] => {
        return [
            {
                payload: JSON.parse(CredentialTypesMocks.CredentialType1),
                id: '5fe4a315d8b45dd2e80bd739',
                schema: null,
                createdAt: '2022-03-17T09:24:38.448Z',
                schemaName: 'education-degree',
                credentialType: 'EducationDegree',
                recommended: false,
            },
            {
                payload: JSON.parse(CredentialTypesMocks.CredentialType2),
                id: '5fe4a315d8b45dd2e80bd73a',
                schema: null,
                createdAt: '2022-03-17T09:24:38.448Z',
                schemaName: 'current-employment-position',
                credentialType: 'CurrentEmploymentPosition',
                recommended: true,
            },
            {
                payload: JSON.parse(CredentialTypesMocks.CredentialType3),
                id: '5fe4a315d8b45dd2e80bd73b',
                schema: null,
                createdAt: '2022-03-17T09:24:38.448Z',
                schemaName: 'past-employment-position',
                credentialType: 'PastEmploymentPosition',
                recommended: false,
            },
        ];
    };

    const getExpectedRecommendedCredentialTypesArr =
        (): VCLCredentialType[] => {
            return [
                {
                    payload: JSON.parse(CredentialTypesMocks.CredentialType2),
                    id: '5fe4a315d8b45dd2e80bd73a',
                    schema: null,
                    createdAt: '2022-03-17T09:24:38.448Z',
                    schemaName: 'current-employment-position',
                    credentialType: 'CurrentEmploymentPosition',
                    recommended: true,
                },
            ];
        };
});
