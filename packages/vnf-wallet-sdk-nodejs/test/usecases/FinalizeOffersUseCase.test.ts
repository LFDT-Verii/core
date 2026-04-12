import { before, describe, test } from 'node:test';
import { expect } from 'expect';
import { GenerateOffersMocks } from '../infrastructure/resources/valid/GenerateOffersMocks';
import FinalizeOffersUseCase from '../../src/impl/domain/usecases/FinalizeOffersUseCase';
import {
    VCLCredentialManifest,
    VCLCredentialTypes,
    VCLFinalizeOffersDescriptor,
    VCLJwt,
    VCLJwtVerifiableCredentials,
    VCLVerifiedProfile,
} from '../../src';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import FinalizeOffersUseCaseImpl from '../../src/impl/data/usecases/FinalizeOffersUseCaseImpl';
import { FinalizeOffersRepositoryImpl } from '../../src/impl/data/repositories/FinalizeOffersRepositoryImpl';
import { CredentialMocks } from '../infrastructure/resources/valid/CredentialMocks';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import { JwtVerifyServiceMock } from '../infrastructure/resources/jwt/JwtVerifyServiceMock';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import VCLErrorCode from '../../src/api/entities/error/VCLErrorCode';
import {
    CredentialDidVerifierImpl,
    CredentialIssuerVerifierImpl,
    CredentialsByDeepLinkVerifierImpl,
} from '../../src/impl/data/verifiers';
import { CredentialTypesModelMock } from '../infrastructure/resources/valid/CredentialTypesModelMock';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { mockAbsolutePost, useNockLifecycle } from '../utils/nock';
import VclBlocksProvider from '../../src/impl/VclBlocksProvider';
import CredentialTypesModel from '../../src/impl/domain/models/CredentialTypesModel';
import VCLError from '../../src/api/entities/error/VCLError';

describe('FinalizeOffersUseCase', () => {
    let subject1: FinalizeOffersUseCase;
    let subject2: FinalizeOffersUseCase;
    let subject3: FinalizeOffersUseCase;
    let subject4: FinalizeOffersUseCase;
    let subject5: FinalizeOffersUseCase;
    let subject6: FinalizeOffersUseCase;
    let subject7: FinalizeOffersUseCase;
    let subject8: FinalizeOffersUseCase;

    const jwtServiceRepository = new JwtServiceRepositoryImpl(
        new JwtSignServiceMock(CommonMocks.JWT.encodedJwt),
        new JwtVerifyServiceMock(),
    );
    const cryptoServicesDescriptor = {
        keyService: {},
        jwtSignService: new JwtSignServiceMock(CommonMocks.JWT.encodedJwt),
        jwtVerifyService: new JwtVerifyServiceMock(),
    } as any;

    const didJwk = DidJwkMocks.DidJwk;
    let credentialManifestFailed: VCLCredentialManifest;
    let credentialManifestPassed: VCLCredentialManifest;
    let finalizeOffersDescriptorFailed: VCLFinalizeOffersDescriptor;
    let finalizeOffersDescriptorPassed: VCLFinalizeOffersDescriptor;
    const vclJwtFailed = VCLJwt.fromEncodedJwt(
        CredentialManifestMocks.JwtCredentialManifest1,
    );
    const vclJwtPassed = VCLJwt.fromEncodedJwt(
        CredentialManifestMocks.JwtCredentialManifestFromRegularIssuer,
    );

    const expectedJwtCredentials = JSON.parse(
        CredentialMocks.JwtCredentialsFromRegularIssuer,
    ).map((jwt: string) => VCLJwt.fromEncodedJwt(jwt));

    before(async () => {
        credentialManifestFailed = new VCLCredentialManifest(
            vclJwtFailed,
            null,
            new VCLVerifiedProfile(
                JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr2),
            ),
            null,
            didJwk,
        );
        credentialManifestPassed = new VCLCredentialManifest(
            vclJwtPassed,
            null,
            new VCLVerifiedProfile(
                JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr2),
            ),
            null,
            didJwk,
        );

        finalizeOffersDescriptorFailed = new VCLFinalizeOffersDescriptor(
            credentialManifestFailed,
            GenerateOffersMocks.Challenge,
            [],
            [],
        );
        finalizeOffersDescriptorPassed = new VCLFinalizeOffersDescriptor(
            credentialManifestPassed,
            GenerateOffersMocks.Challenge,
            [],
            [],
        );
    });

    useNockLifecycle();

    test('marks invalid credentials as failed', async () => {
        subject1 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                new CredentialTypesModelMock(
                    CredentialTypesModelMock.IssuerCategoryRegularIssuer,
                ),
                new NetworkServiceImpl(),
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            ),
        );
        const scope = mockAbsolutePost(
            finalizeOffersDescriptorFailed.finalizeOffersUri,
            finalizeOffersDescriptorFailed.generateRequestBody(CommonMocks.JWT),
            JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer),
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        try {
            await subject1.finalizeOffers(
                finalizeOffersDescriptorFailed,
                CommonMocks.Token,
            );
            expect(true).toEqual(false);
        } catch (error: any) {
            expect(error.errorCode).toEqual(
                VCLErrorCode.IssuerRequiresNotaryPermission,
            );
        }

        expect(scope.isDone()).toBeTruthy();
    });

    test('returns verified credentials', async () => {
        subject2 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                new CredentialTypesModelMock(
                    CredentialTypesModelMock.IssuerCategoryRegularIssuer,
                ),
                new NetworkServiceImpl(),
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            ),
        );
        const scope = mockAbsolutePost(
            finalizeOffersDescriptorPassed.finalizeOffersUri,
            finalizeOffersDescriptorPassed.generateRequestBody(CommonMocks.JWT),
            JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer),
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const finalizeOffers = await subject2.finalizeOffers(
            finalizeOffersDescriptorPassed,
            CommonMocks.Token,
        );

        expect(finalizeOffers).toEqual(
            new VCLJwtVerifiableCredentials(expectedJwtCredentials, []),
        );
        expect(scope.isDone()).toBeTruthy();
    });

    test('returns an empty credential list', async () => {
        subject3 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                new CredentialTypesModelMock(
                    CredentialTypesModelMock.IssuerCategoryRegularIssuer,
                ),
                new NetworkServiceImpl(),
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            ),
        );
        const scope = mockAbsolutePost(
            finalizeOffersDescriptorPassed.finalizeOffersUri,
            finalizeOffersDescriptorPassed.generateRequestBody(CommonMocks.JWT),
            JSON.parse(CredentialMocks.JwtEmptyCredentials),
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const finalizeOffers = await subject3.finalizeOffers(
            finalizeOffersDescriptorPassed,
            CommonMocks.Token,
        );

        expect(finalizeOffers).toEqual(new VCLJwtVerifiableCredentials([], []));
        expect(scope.isDone()).toBeTruthy();
    });

    test('propagates finalize offers failures', async () => {
        subject4 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                new CredentialTypesModelMock(
                    CredentialTypesModelMock.IssuerCategoryRegularIssuer,
                ),
                new NetworkServiceImpl(),
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            ),
        );
        const scope = mockAbsolutePost(
            finalizeOffersDescriptorPassed.finalizeOffersUri,
            finalizeOffersDescriptorPassed.generateRequestBody(CommonMocks.JWT),
            { payload: 'wrong payload' },
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        try {
            await subject4.finalizeOffers(
                finalizeOffersDescriptorPassed,
                CommonMocks.Token,
            );
            expect(true).toEqual(false);
        } catch (error: any) {
            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
        }

        expect(scope.isDone()).toBeTruthy();
    });

    test('allows credentials when direct issuer checks are disabled', async () => {
        subject5 = VclBlocksProvider.provideFinalizeOffersUseCase(
            new CredentialTypesModelMock(
                CredentialTypesModelMock.IssuerCategoryRegularIssuer,
            ),
            cryptoServicesDescriptor,
            false,
        );
        const scope = mockAbsolutePost(
            finalizeOffersDescriptorFailed.finalizeOffersUri,
            finalizeOffersDescriptorFailed.generateRequestBody(CommonMocks.JWT),
            JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer),
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const finalizeOffers = await subject5.finalizeOffers(
            finalizeOffersDescriptorFailed,
            CommonMocks.Token,
        );

        expect(finalizeOffers).toEqual(
            new VCLJwtVerifiableCredentials([], expectedJwtCredentials),
        );
        expect(scope.isDone()).toBeTruthy();
    });

    test('treats null credential types data as empty metadata', async () => {
        subject6 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                createCredentialTypesModel(null),
                new NetworkServiceImpl(),
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            ),
        );
        const scope = mockAbsolutePost(
            finalizeOffersDescriptorFailed.finalizeOffersUri,
            finalizeOffersDescriptorFailed.generateRequestBody(CommonMocks.JWT),
            JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer),
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const finalizeOffers = await subject6.finalizeOffers(
            finalizeOffersDescriptorFailed,
            CommonMocks.Token,
        );

        expect(finalizeOffers).toEqual(
            new VCLJwtVerifiableCredentials([], expectedJwtCredentials),
        );
        expect(scope.isDone()).toBeTruthy();
    });

    test('treats missing or unmatched credential type metadata as empty metadata', async () => {
        subject7 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                createCredentialTypesModel(
                    VCLCredentialTypes.fromPayload(
                        CredentialTypesModelMock.Payload.map((payload) => ({
                            ...payload,
                            credentialType: `unmatched-${payload.credentialType}`,
                        })),
                    ),
                ),
                new NetworkServiceImpl(),
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            ),
        );
        const scope1 = mockAbsolutePost(
            finalizeOffersDescriptorFailed.finalizeOffersUri,
            finalizeOffersDescriptorFailed.generateRequestBody(CommonMocks.JWT),
            JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer),
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const finalizeOffers1 = await subject7.finalizeOffers(
            finalizeOffersDescriptorFailed,
            CommonMocks.Token,
        );

        expect(finalizeOffers1).toEqual(
            new VCLJwtVerifiableCredentials([], expectedJwtCredentials),
        );
        expect(scope1.isDone()).toBeTruthy();

        subject7 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                createCredentialTypesModel({} as VCLCredentialTypes),
                new NetworkServiceImpl(),
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            ),
        );
        const scope2 = mockAbsolutePost(
            finalizeOffersDescriptorFailed.finalizeOffersUri,
            finalizeOffersDescriptorFailed.generateRequestBody(CommonMocks.JWT),
            JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer),
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const finalizeOffers2 = await subject7.finalizeOffers(
            finalizeOffersDescriptorFailed,
            CommonMocks.Token,
        );

        expect(finalizeOffers2).toEqual(
            new VCLJwtVerifiableCredentials([], expectedJwtCredentials),
        );
        expect(scope2.isDone()).toBeTruthy();
    });

    test('matches credential type metadata case-insensitively', async () => {
        subject8 = new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            jwtServiceRepository,
            new CredentialIssuerVerifierImpl(
                createCredentialTypesModel(
                    VCLCredentialTypes.fromPayload(
                        CredentialTypesModelMock.Payload.map((payload) => ({
                            ...payload,
                            credentialType:
                                payload.credentialType?.toLowerCase?.() ??
                                payload.credentialType,
                        })),
                    ),
                ),
                new NetworkServiceImpl(),
            ),
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            ),
        );
        const scope = mockAbsolutePost(
            finalizeOffersDescriptorFailed.finalizeOffersUri,
            finalizeOffersDescriptorFailed.generateRequestBody(CommonMocks.JWT),
            JSON.parse(CredentialMocks.JwtCredentialsFromRegularIssuer),
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        try {
            await subject8.finalizeOffers(
                finalizeOffersDescriptorFailed,
                CommonMocks.Token,
            );
            expect(true).toEqual(false);
        } catch (error: any) {
            expect(error.errorCode).toEqual(
                VCLErrorCode.IssuerRequiresNotaryPermission,
            );
        }

        expect(scope.isDone()).toBeTruthy();
    });

    const createCredentialTypesModel = (
        data: VCLCredentialTypes | null,
    ): CredentialTypesModel =>
        ({
            get data() {
                return data as any;
            },
            initialize: (): Promise<VCLError | null> => Promise.resolve(null),
        }) as CredentialTypesModel;
});
