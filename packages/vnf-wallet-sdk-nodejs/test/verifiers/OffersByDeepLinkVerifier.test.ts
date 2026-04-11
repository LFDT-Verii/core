/**
 * Created by Michael Avoyan on 05/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test } from 'node:test';
import { expect } from 'expect';
import { CredentialManifestDescriptorMocks } from '../infrastructure/resources/valid/CredentialManifestDescriptorMocks';
import { OffersByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import { VCLErrorCode, VCLJwt, VCLOffers, VCLToken } from '../../src';
import { GenerateOffersMocks } from '../infrastructure/resources/valid/GenerateOffersMocks';
import OffersByDeepLinkVerifier from '../../src/impl/domain/verifiers/OffersByDeepLinkVerifier';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import { mockResolveDid, useNockLifecycle } from '../utils/nock';

describe('OffersByDeepLinkVerifierTest', () => {
    let subject: OffersByDeepLinkVerifier;

    const deepLink = CredentialManifestDescriptorMocks.DeepLink;

    const offers = new VCLOffers(
        GenerateOffersMocks.RealOffersJson,
        VCLOffers.offersFromJsonArray(
            GenerateOffersMocks.RealOffersJson[VCLOffers.CodingKeys.KeyOffers],
        ),
        0,
        CommonMocks.Token,
        '',
    );

    useNockLifecycle();

    test('testVerifyOffersSuccess', async () => {
        subject = new OffersByDeepLinkVerifierImpl(
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
        );
        const scope = mockResolveDid(
            deepLink.did!,
            DidDocumentMocks.DidDocumentMock.payload,
        );

        const isVerified = await subject.verifyOffers(offers, deepLink);
        expect(isVerified).toBeTruthy();
        expect(scope.isDone()).toBeTruthy();
    });

    test('testVerifyOffersError', async () => {
        subject = new OffersByDeepLinkVerifierImpl(
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
        );
        const scope = mockResolveDid(
            deepLink.did!,
            DidDocumentMocks.DidDocumentWithWrongDidMock.payload,
        );
        try {
            const isVerified = await subject.verifyOffers(offers, deepLink);
            expect(isVerified).toBeFalsy();
        } catch (error: any) {
            expect(error.errorCode).toEqual(
                VCLErrorCode.MismatchedOfferIssuerDid,
            );
        }
        expect(scope.isDone()).toBeTruthy();
    });
});
