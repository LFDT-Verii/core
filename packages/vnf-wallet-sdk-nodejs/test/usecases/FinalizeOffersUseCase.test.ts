import { beforeAll, expect } from '@jest/globals';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import { GenerateOffersMocks } from '../infrastructure/resources/valid/GenerateOffersMocks';
import FinalizeOffersUseCase from '../../src/impl/domain/usecases/FinalizeOffersUseCase';
import {
    VCLCredentialManifest,
    VCLFinalizeOffersDescriptor,
    VCLGenerateOffersDescriptor,
    VCLJwt,
    VCLToken,
    VCLVerifiedProfile,
} from '../../src';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import GenerateOffersUseCaseImpl from '../../src/impl/data/usecases/GenerateOffersUseCaseImpl';
import GenerateOffersRepositoryImpl from '../../src/impl/data/repositories/GenerateOffersRepositoryImpl';
import FinalizeOffersUseCaseImpl from '../../src/impl/data/usecases/FinalizeOffersUseCaseImpl';
import { FinalizeOffersRepositoryImpl } from '../../src/impl/data/repositories/FinalizeOffersRepositoryImpl';
import { CredentialMocks } from '../infrastructure/resources/valid/CredentialMocks';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { JsonLdMocks } from '../infrastructure/resources/valid/JsonLdMocks';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import { JwtVerifyServiceMock } from '../infrastructure/resources/jwt/JwtVerifyServiceMock';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import VCLErrorCode from '../../src/api/entities/error/VCLErrorCode';
import {
    CredentialDidVerifierImpl,
    CredentialIssuerVerifierImpl,
    CredentialsByDeepLinkVerifierImpl,
    OffersByDeepLinkVerifierImpl,
} from '../../src/impl/data/verifiers';
import { CredentialTypesModelMock } from '../infrastructure/resources/valid/CredentialTypesModelMock';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';

describe('FinalizeOffersUseCase Tests', () => {
    let subject1: FinalizeOffersUseCase;
    let subject2: FinalizeOffersUseCase;
    let subject3: FinalizeOffersUseCase;
    let subject4: FinalizeOffersUseCase;

    const jwtServiceRepository = new JwtServiceRepositoryImpl(
        new JwtSignServiceMock(),
        new JwtVerifyServiceMock()
    );

    const didJwk = DidJwkMocks.DidJwk;
    let credentialManifestFailed: VCLCredentialManifest;
    let credentialManifestPassed: VCLCredentialManifest;
    let finalizeOffersDescriptorFailed: VCLFinalizeOffersDescriptor;
    let finalizeOffersDescriptorPassed: VCLFinalizeOffersDescriptor;
    const vclJwtFailed = VCLJwt.fromEncodedJwt(
        CredentialManifestMocks.JwtCredentialManifest1
    );
    const vclJwtPassed = VCLJwt.fromEncodedJwt(
        CredentialManifestMocks.JwtCredentialManifestFromRegularIssuer
    );

    const credentialsAmount = JSON.parse(
        CredentialMocks.JwtCredentialsFromRegularIssuer
    ).length;

    beforeAll(async () => {
        const generateOffersDescriptor = new VCLGenerateOffersDescriptor(
            new VCLCredentialManifest(
                CommonMocks.JWT,
                '',
                new VCLVerifiedProfile(
                    JSON.parse(
                        VerifiedProfileMocks.VerifiedProfileIssuerJsonStr2
                    )
                ),
                null,
                didJwk
            ),
            [],
            [],
            []
        );
        const offers = await new GenerateOffersUseCaseImpl(
            new GenerateOffersRepositoryImpl(
                new NetworkServiceSuccess(GenerateOffersMocks.GeneratedOffers)
            ),
            new OffersByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(
                    new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
                )
            )
        ).generateOffers(generateOffersDescriptor, new VCLToken(''));

        expect(offers.challenge).toEqual(GenerateOffersMocks.Challenge);

        credentialManifestFailed = new VCLCredentialManifest(
            vclJwtFailed,
            null,
            new VCLVerifiedProfile(
                JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr2)
            ),
            null,
            didJwk
        );
        credentialManifestPassed = new VCLCredentialManifest(
            vclJwtPassed,
            null,
            new VCLVerifiedProfile(
                JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr2)
            ),
            null,
            didJwk
        );

        finalizeOffersDescriptorFailed = new VCLFinalizeOffersDescriptor(
            credentialManifestFailed,
            offers.challenge!,
            [],
            []
        );
        finalizeOffersDescriptorPassed = new VCLFinalizeOffersDescriptor(
            credentialManifestPassed,
            offers.challenge!,
            [],
            []
        );
    });

    test('testFailedCredentials', async () => {
        subject1 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(
                new NetworkServiceSuccess(
                    JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer)
                )
            ),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                new CredentialTypesModelMock(
                    CredentialTypesModelMock.IssuerCategoryRegularIssuer
                ),
                new NetworkServiceSuccess(
                    JSON.parse(JsonLdMocks.Layer1v10Jsonld)
                )
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(
                    new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
                )
            )
        );

        try {
            await subject1.finalizeOffers(
                finalizeOffersDescriptorFailed,
                new VCLToken('')
            );
            expect(true).toEqual(false);
        } catch (error: any) {
            expect(error.errorCode).toEqual(
                VCLErrorCode.IssuerRequiresNotaryPermission
            );
        }
    });

    test('testPassedCredentials', async () => {
        subject2 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(
                new NetworkServiceSuccess(
                    JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer)
                )
            ),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                new CredentialTypesModelMock(
                    CredentialTypesModelMock.IssuerCategoryRegularIssuer
                ),
                new NetworkServiceSuccess(
                    JSON.parse(JsonLdMocks.Layer1v10Jsonld)
                )
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(
                    new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
                )
            )
        );

        const finalizeOffers = await subject2.finalizeOffers(
            finalizeOffersDescriptorPassed,
            new VCLToken('')
        );

        expect(finalizeOffers.passedCredentials.length).toEqual(
            credentialsAmount
        );
        expect(
            finalizeOffers.passedCredentials.some(
                (cred) =>
                    cred.encodedJwt ===
                    CredentialMocks.JwtCredentialEducationDegreeRegistrationFromRegularIssuer
            )
        ).toEqual(true);
        expect(
            finalizeOffers.passedCredentials.some(
                (cred) =>
                    cred.encodedJwt ===
                    CredentialMocks.JwtCredentialEmploymentPastFromRegularIssuer
            )
        ).toEqual(true);
        expect(finalizeOffers.failedCredentials.length).toEqual(0);
    });

    test('testEmptyCredentials', async () => {
        subject3 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(
                new NetworkServiceSuccess(
                    JSON.parse(CredentialMocks.JwtEmptyCredentials)
                )
            ),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                new CredentialTypesModelMock(
                    CredentialTypesModelMock.IssuerCategoryRegularIssuer
                ),
                new NetworkServiceSuccess(
                    JSON.parse(JsonLdMocks.Layer1v10Jsonld)
                )
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(
                    new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
                )
            )
        );

        const finalizeOffers = await subject3.finalizeOffers(
            finalizeOffersDescriptorPassed,
            new VCLToken('')
        );

        expect(finalizeOffers.failedCredentials.length).toEqual(0);
        expect(finalizeOffers.passedCredentials.length).toEqual(0);
    });

    test('testFailure', async () => {
        subject4 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(
                new NetworkServiceSuccess({ payload: 'wrong payload' })
            ),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                new CredentialTypesModelMock(
                    CredentialTypesModelMock.IssuerCategoryRegularIssuer
                ),
                new NetworkServiceSuccess(
                    JSON.parse(JsonLdMocks.Layer1v10Jsonld)
                )
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(
                    new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
                )
            )
        );

        try {
            await subject4.finalizeOffers(
                finalizeOffersDescriptorPassed,
                new VCLToken('')
            );
            expect(true).toEqual(false);
        } catch (error: any) {
            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
        }
    });
});
