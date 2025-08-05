import { describe, it } from 'node:test';
import { expect } from 'expect';
import GenerateOffersUseCase from '../../src/impl/domain/usecases/GenerateOffersUseCase';
import GenerateOffersRepositoryImpl from '../../src/impl/data/repositories/GenerateOffersRepositoryImpl';
import GenerateOffersUseCaseImpl from '../../src/impl/data/usecases/GenerateOffersUseCaseImpl';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import { GenerateOffersMocks } from '../infrastructure/resources/valid/GenerateOffersMocks';
import {
    VCLCredentialManifest,
    VCLGenerateOffersDescriptor,
    VCLVerifiedProfile,
} from '../../src';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import { OffersByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';

describe('GenerateOffersUseCaseTest', () => {
    let subject1: GenerateOffersUseCase;
    let subject2: GenerateOffersUseCase;
    let subject3: GenerateOffersUseCase;

    const verifiedProfile = new VCLVerifiedProfile(
        JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1)
    );

    it('testGenerateOffers', async () => {
        subject1 = new GenerateOffersUseCaseImpl(
            new GenerateOffersRepositoryImpl(
                new NetworkServiceSuccess(GenerateOffersMocks.GeneratedOffers)
            ),
            new OffersByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(
                    new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
                )
            )
        );

        const generateOffersDescriptor = new VCLGenerateOffersDescriptor(
            new VCLCredentialManifest(
                CommonMocks.JWT,
                null,
                verifiedProfile,
                null,
                DidJwkMocks.DidJwk,
                null
            ),
            null,
            null,
            []
        );

        const offers = await subject1.generateOffers(
            generateOffersDescriptor,
            CommonMocks.Token
        );
        expect(offers.payload).toEqual(GenerateOffersMocks.GeneratedOffers);
        expect(offers.all.map((offer) => offer.payload)).toStrictEqual(
            GenerateOffersMocks.Offers
        );
        expect(offers.challenge).toEqual(GenerateOffersMocks.Challenge);
        expect(offers?.sessionToken).toStrictEqual(CommonMocks.Token);
    });

    it('testGenerateOffersEmptyJsonObj', async () => {
        subject2 = new GenerateOffersUseCaseImpl(
            new GenerateOffersRepositoryImpl(
                new NetworkServiceSuccess(
                    GenerateOffersMocks.GeneratedOffersEmptyJsonObj
                )
            ),
            new OffersByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(
                    new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
                )
            )
        );

        const generateOffersDescriptor = new VCLGenerateOffersDescriptor(
            new VCLCredentialManifest(
                CommonMocks.JWT,
                null,
                verifiedProfile,
                null,
                DidJwkMocks.DidJwk
            ),
            null,
            null,
            []
        );

        const offers = await subject2.generateOffers(
            generateOffersDescriptor,
            CommonMocks.Token
        );
        expect(offers.all).toEqual([]);
        expect(offers.challenge).toBeNull();
        expect(offers?.sessionToken).toStrictEqual(CommonMocks.Token);
    });

    it('testGenerateOffersEmptyJsonArr', async () => {
        subject3 = new GenerateOffersUseCaseImpl(
            new GenerateOffersRepositoryImpl(
                new NetworkServiceSuccess(
                    GenerateOffersMocks.GeneratedOffersEmptyJsonArr
                )
            ),
            new OffersByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(
                    new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
                )
            )
        );

        const generateOffersDescriptor = new VCLGenerateOffersDescriptor(
            new VCLCredentialManifest(
                CommonMocks.JWT,
                null,
                verifiedProfile,
                null,
                DidJwkMocks.DidJwk,
                null
            ),
            null,
            null,
            []
        );

        const offers = await subject3.generateOffers(
            generateOffersDescriptor,
            CommonMocks.Token
        );
        expect(offers.all).toEqual([]);
        expect(offers.challenge).toBeNull();
        expect(offers?.sessionToken).toStrictEqual(CommonMocks.Token);
    });
});
