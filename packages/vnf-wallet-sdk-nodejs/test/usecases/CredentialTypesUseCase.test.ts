import { describe, test } from 'node:test';
import { expect } from 'expect';
import { CredentialTypesMocks } from '../infrastructure/resources/valid/CredentialTypesMocks';
import CredentialTypesRepositoryImpl from '../../src/impl/data/repositories/CredentialTypesRepositoryImpl';
import CredentialTypesUseCaseImpl from '../../src/impl/data/usecases/CredentialTypesUseCaseImpl';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { VCLCredentialType, VCLErrorCode } from '../../src';
import { mockRegistrarGet, useNockLifecycle } from '../utils/nock';

describe('CredentialTypesUseCase', () => {
    const subject = new CredentialTypesUseCaseImpl(
        new CredentialTypesRepositoryImpl(new NetworkServiceImpl()),
    );

    useNockLifecycle();

    test('returns credential types', async () => {
        const scope = mockRegistrarGet(
            '/api/v0.6/credential-types',
            JSON.parse(CredentialTypesMocks.CredentialTypesJsonStr),
        );

        const credentialTypes = await subject.getCredentialTypes();

        compareCredentialTypes(
            credentialTypes.all!,

            getExpectedCredentialTypesArr(),
        );

        compareCredentialTypes(
            credentialTypes.recommendedTypes!,

            getExpectedRecommendedCredentialTypesArr(),
        );
        expect(scope.isDone()).toBeTruthy();
    });

    test('throws an sdk error for an invalid credential types response', async () => {
        const scope = mockRegistrarGet('/api/v0.6/credential-types', {
            wrong: 'payload',
        });

        try {
            await subject.getCredentialTypes();
            expect(false).toEqual(true);
        } catch (error: any) {
            expect(error.errorCode).toEqual(VCLErrorCode.SdkError.toString());
        }

        expect(scope.isDone()).toBeTruthy();
    });

    const compareCredentialTypes = (
        credentialTypesArr1: VCLCredentialType[],
        credentialTypesArr2: VCLCredentialType[],
    ) => {
        expect(credentialTypesArr1).toEqual(credentialTypesArr2);
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
