import { describe, test } from 'node:test';
import { expect } from 'expect';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import VerifiedProfileUseCaseImpl from '../../src/impl/data/usecases/VerifiedProfileUseCaseImpl';
import VerifiedProfileRepositoryImpl from '../../src/impl/data/repositories/VerifiedProfileRepositoryImpl';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { VCLVerifiedProfile, VCLVerifiedProfileDescriptor } from '../../src';

describe('CredentialTypesUseCaseImpl Tests', () => {
    const subject1 = new VerifiedProfileUseCaseImpl(
        new VerifiedProfileRepositoryImpl(
            new NetworkServiceSuccess(
                JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1)
            )
        )
    );
    const subject2 = new VerifiedProfileUseCaseImpl(
        new VerifiedProfileRepositoryImpl(
            new NetworkServiceSuccess(
                JSON.parse(
                    VerifiedProfileMocks.VerifiedProfileIssuerInspectorJsonStr
                )
            )
        )
    );
    const subject3 = new VerifiedProfileUseCaseImpl(
        new VerifiedProfileRepositoryImpl(
            new NetworkServiceSuccess(
                JSON.parse(
                    VerifiedProfileMocks.VerifiedProfileNotaryIssuerJsonStr
                )
            )
        )
    );
    const subject4 = new VerifiedProfileUseCaseImpl(
        new VerifiedProfileRepositoryImpl(
            new NetworkServiceSuccess(
                JSON.parse(
                    VerifiedProfileMocks.VerifiedProfileNotaryIssuerJsonStr
                )
            )
        )
    );

    test('testGetVerifiedProfileIssuerSuccess', async () => {
        const verifiedProfile = await subject1.getVerifiedProfile(
            new VCLVerifiedProfileDescriptor('did123')
        );
        compareVerifiedProfile(verifiedProfile);
    });

    test('testGetVerifiedProfileIssuerInspector1Success', async () => {
        const verifiedProfile = await subject2.getVerifiedProfile(
            new VCLVerifiedProfileDescriptor('did123')
        );
        compareVerifiedProfile(verifiedProfile);
    });

    test('testGetVerifiedProfileIssuerInspector2Success', async () => {
        const verifiedProfile = await subject3.getVerifiedProfile(
            new VCLVerifiedProfileDescriptor('did123')
        );
        compareVerifiedProfile(verifiedProfile);
    });

    test('testGetVerifiedProfileIssuerNotaryIssuer2Success', async () => {
        const verifiedProfile = await subject4.getVerifiedProfile(
            new VCLVerifiedProfileDescriptor('did123')
        );
        compareVerifiedProfile(verifiedProfile);
    });

    const compareVerifiedProfile = (verifiedProfile: VCLVerifiedProfile) => {
        expect(verifiedProfile.id).toEqual(VerifiedProfileMocks.ExpectedId);
        expect(verifiedProfile.logo).toEqual(VerifiedProfileMocks.ExpectedLogo);
        expect(verifiedProfile.name).toEqual(VerifiedProfileMocks.ExpectedName);
    };
});
