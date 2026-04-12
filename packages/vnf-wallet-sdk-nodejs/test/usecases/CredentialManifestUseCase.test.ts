import { describe, test } from 'node:test';
import { expect } from 'expect';
import CredentialManifestUseCase from '../../src/impl/domain/usecases/CredentialManifestUseCase';
import CredentialManifestUseCaseImpl from '../../src/impl/data/usecases/CredentialManifestUseCaseImpl';
import CredentialManifestRepositoryImpl from '../../src/impl/data/repositories/CredentialManifestRepositoryImpl';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { JwtVerifyServiceMock } from '../infrastructure/resources/jwt/JwtVerifyServiceMock';
import {
    VCLCredentialManifest,
    VCLCredentialManifestDescriptorByDeepLink,
    VCLErrorCode,
    VCLIssuingType,
    VCLJwt,
    VCLVerifiedProfile,
} from '../../src';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { CredentialManifestByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import {
    mockAbsoluteGet,
    mockResolveDid,
    useNockLifecycle,
} from '../utils/nock';

describe('CredentialManifestUseCase', () => {
    const credentialManifestDescriptor =
        new VCLCredentialManifestDescriptorByDeepLink(
            DeepLinkMocks.CredentialManifestDeepLinkDevNet,
            VCLIssuingType.Career,
            null,
            DidJwkMocks.DidJwk,
            CommonMocks.Token,
        );
    const subject: CredentialManifestUseCase =
        new CredentialManifestUseCaseImpl(
            new CredentialManifestRepositoryImpl(new NetworkServiceImpl()),
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            new JwtServiceRepositoryImpl(
                new JwtSignServiceMock(''),
                new JwtVerifyServiceMock(),
            ),
            new CredentialManifestByDeepLinkVerifierImpl(),
        );

    useNockLifecycle();

    test('returns a credential manifest', async () => {
        const verifiedProfile = new VCLVerifiedProfile(
            JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1),
        );
        const requestScope = mockAbsoluteGet(
            credentialManifestDescriptor.endpoint!,
            JSON.parse(CredentialManifestMocks.CredentialManifest1),
        );
        const didScope = mockResolveDid(
            DeepLinkMocks.IssuerDid,
            DidDocumentMocks.DidDocumentMock.payload,
        );

        try {
            const credentialManifest = await subject.getCredentialManifest(
                credentialManifestDescriptor,
                verifiedProfile,
            );
            const expectedCredentialManifest = new VCLCredentialManifest(
                VCLJwt.fromEncodedJwt(
                    CredentialManifestMocks.JwtCredentialManifest1,
                ),
                credentialManifestDescriptor.vendorOriginContext,
                verifiedProfile,
                credentialManifestDescriptor.deepLink,
                DidJwkMocks.DidJwk,
                CommonMocks.Token,
            );

            expect(credentialManifest).toEqual(expectedCredentialManifest);
        } catch (error) {
            expect(error).toBeNull();
        }

        expect(requestScope.isDone()).toBeTruthy();
        expect(didScope.isDone()).toBeTruthy();
    });

    test('throws an sdk error for an invalid credential manifest response', async () => {
        const requestScope = mockAbsoluteGet(
            credentialManifestDescriptor.endpoint!,
            { wrong: 'payload' },
        );

        try {
            await subject.getCredentialManifest(
                new VCLCredentialManifestDescriptorByDeepLink(
                    DeepLinkMocks.CredentialManifestDeepLinkDevNet,
                    VCLIssuingType.Career,
                    null,
                    DidJwkMocks.DidJwk,
                ),
                new VCLVerifiedProfile(
                    JSON.parse(
                        VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1,
                    ),
                ),
            );
            expect(true).toEqual(false);
        } catch (error: any) {
            expect(error?.errorCode).toEqual(VCLErrorCode.SdkError.toString());
        }

        expect(requestScope.isDone()).toBeTruthy();
    });
});
