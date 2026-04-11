import { describe, test } from 'node:test';
import { expect } from 'expect';
import VerifiedProfileUseCaseImpl from '../../src/impl/data/usecases/VerifiedProfileUseCaseImpl';
import VerifiedProfileRepositoryImpl from '../../src/impl/data/repositories/VerifiedProfileRepositoryImpl';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { VCLVerifiedProfile, VCLVerifiedProfileDescriptor } from '../../src';
import { mockRegistrarGet, useNockLifecycle } from '../utils/nock';

describe('CredentialTypesUseCaseImpl Tests', () => {
    const subject = new VerifiedProfileUseCaseImpl(
        new VerifiedProfileRepositoryImpl(new NetworkServiceImpl()),
    );
    const expectedPath = '/api/v0.6/organizations/did123/verified-profile';

    useNockLifecycle();

    test('testGetVerifiedProfileIssuerSuccess', async () => {
        const expectedPayload = JSON.parse(
            VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1,
        );
        const scope = mockRegistrarGet(expectedPath, expectedPayload);

        const verifiedProfile = await subject.getVerifiedProfile(
            new VCLVerifiedProfileDescriptor('did123'),
        );

        compareVerifiedProfile(verifiedProfile, expectedPayload);
        expect(scope.isDone()).toBeTruthy();
    });

    test('testGetVerifiedProfileIssuerInspector1Success', async () => {
        const expectedPayload = JSON.parse(
            VerifiedProfileMocks.VerifiedProfileIssuerInspectorJsonStr,
        );
        const scope = mockRegistrarGet(expectedPath, expectedPayload);

        const verifiedProfile = await subject.getVerifiedProfile(
            new VCLVerifiedProfileDescriptor('did123'),
        );

        compareVerifiedProfile(verifiedProfile, expectedPayload);
        expect(scope.isDone()).toBeTruthy();
    });

    test('testGetVerifiedProfileIssuerInspector2Success', async () => {
        const expectedPayload = JSON.parse(
            VerifiedProfileMocks.VerifiedProfileNotaryIssuerJsonStr,
        );
        const scope = mockRegistrarGet(expectedPath, expectedPayload);

        const verifiedProfile = await subject.getVerifiedProfile(
            new VCLVerifiedProfileDescriptor('did123'),
        );

        compareVerifiedProfile(verifiedProfile, expectedPayload);
        expect(scope.isDone()).toBeTruthy();
    });

    test('testGetVerifiedProfileIssuerNotaryIssuer2Success', async () => {
        const expectedPayload = JSON.parse(
            VerifiedProfileMocks.VerifiedProfileNotaryIssuerJsonStr,
        );
        const scope = mockRegistrarGet(expectedPath, expectedPayload);

        const verifiedProfile = await subject.getVerifiedProfile(
            new VCLVerifiedProfileDescriptor('did123'),
        );

        compareVerifiedProfile(verifiedProfile, expectedPayload);
        expect(scope.isDone()).toBeTruthy();
    });

    const compareVerifiedProfile = (
        verifiedProfile: VCLVerifiedProfile,
        expectedPayload: Record<string, unknown>,
    ) => {
        expect(verifiedProfile).toEqual(
            new VCLVerifiedProfile(expectedPayload),
        );
    };
});
