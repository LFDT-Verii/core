import { describe, it } from 'node:test';
import { expect } from 'expect';
import GenerateOffersUseCase from '../../src/impl/domain/usecases/GenerateOffersUseCase';
import GenerateOffersRepositoryImpl from '../../src/impl/data/repositories/GenerateOffersRepositoryImpl';
import GenerateOffersUseCaseImpl from '../../src/impl/data/usecases/GenerateOffersUseCaseImpl';
import { GenerateOffersMocks } from '../infrastructure/resources/valid/GenerateOffersMocks';
import {
    VCLCredentialManifest,
    VCLGenerateOffersDescriptor,
    VCLJwt,
    VCLOffer,
    VCLOffers,
    VCLVerifiedProfile,
} from '../../src';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import { OffersByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { mockAbsolutePost, useNockLifecycle } from '../utils/nock';

describe('GenerateOffersUseCase', () => {
    const verifiedProfile = new VCLVerifiedProfile(
        JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1),
    );
    const credentialManifest = new VCLCredentialManifest(
        VCLJwt.fromEncodedJwt(CredentialManifestMocks.JwtCredentialManifest1),
        null,
        verifiedProfile,
        null,
        DidJwkMocks.DidJwk,
        null,
    );
    const subject: GenerateOffersUseCase = new GenerateOffersUseCaseImpl(
        new GenerateOffersRepositoryImpl(new NetworkServiceImpl()),
        new OffersByDeepLinkVerifierImpl(
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
        ),
    );

    useNockLifecycle();

    it('returns generated offers', async () => {
        const generateOffersDescriptor = new VCLGenerateOffersDescriptor(
            credentialManifest,
            null,
            null,
            [],
        );
        const scope = mockAbsolutePost(
            credentialManifest.checkOffersUri,
            generateOffersDescriptor.payload,
            GenerateOffersMocks.GeneratedOffers,
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const offers = await subject.generateOffers(
            generateOffersDescriptor,
            CommonMocks.Token,
        );
        expect(offers).toEqual(
            new VCLOffers(
                GenerateOffersMocks.GeneratedOffers,
                GenerateOffersMocks.Offers.map(
                    (offerPayload) => new VCLOffer(offerPayload),
                ),
                200,
                CommonMocks.Token,
                GenerateOffersMocks.Challenge,
            ),
        );
        expect(scope.isDone()).toBeTruthy();
    });

    it('returns empty offers from an empty object response', async () => {
        const generateOffersDescriptor = new VCLGenerateOffersDescriptor(
            credentialManifest,
            null,
            null,
            [],
        );
        const scope = mockAbsolutePost(
            credentialManifest.checkOffersUri,
            generateOffersDescriptor.payload,
            GenerateOffersMocks.GeneratedOffersEmptyJsonObj,
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const offers = await subject.generateOffers(
            generateOffersDescriptor,
            CommonMocks.Token,
        );
        expect(offers).toEqual(new VCLOffers({}, [], 200, CommonMocks.Token));
        expect(scope.isDone()).toBeTruthy();
    });

    it('returns empty offers from an empty array response', async () => {
        const generateOffersDescriptor = new VCLGenerateOffersDescriptor(
            credentialManifest,
            null,
            null,
            [],
        );
        const scope = mockAbsolutePost(
            credentialManifest.checkOffersUri,
            generateOffersDescriptor.payload,
            GenerateOffersMocks.GeneratedOffersEmptyJsonArr,
            200,
            {
                authorization: `Bearer ${CommonMocks.Token.value}`,
            },
        );

        const offers = await subject.generateOffers(
            generateOffersDescriptor,
            CommonMocks.Token,
        );
        expect(offers).toEqual(
            new VCLOffers({ offers: [] }, [], 200, CommonMocks.Token),
        );
        expect(scope.isDone()).toBeTruthy();
    });
});
