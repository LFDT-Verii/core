/**
 * Created by Michael Avoyan on 05/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test } from 'node:test';
import { expect } from 'expect';
import {
    VCLDeepLink,
    VCLErrorCode,
    VCLJwt,
    VCLPresentationRequest,
    VCLVerifiedProfile,
} from '../../src';
import { PresentationRequestByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import PresentationRequestByDeepLinkVerifier from '../../src/impl/domain/verifiers/PresentationRequestByDeepLinkVerifier';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';

describe('PresentationRequestByDeepLinkVerifier', () => {
    let subject: PresentationRequestByDeepLinkVerifier;

    const presentationRequest = PresentationRequestMocks.PresentationRequest;

    const deepLink = DeepLinkMocks.PresentationRequestDeepLinkDevNet;

    const createPresentationRequest = (iss: string): VCLPresentationRequest => {
        const jwt = VCLJwt.fromEncodedJwt(
            PresentationRequestMocks.EncodedPresentationRequest,
        );
        jwt.payload.iss = iss;
        return new VCLPresentationRequest(
            jwt,
            new VCLVerifiedProfile({}),
            new VCLDeepLink('velocity-network://inspect'),
            null,
            DidJwkMocks.DidJwk,
        );
    };

    test('verifies a matching presentation request deep link', () => {
        subject = new PresentationRequestByDeepLinkVerifierImpl();

        expect(() =>
            subject.verifyPresentationRequest(
                presentationRequest,
                deepLink,
                DidDocumentMocks.DidDocumentMock,
            ),
        ).not.toThrow();
    });

    test('verifies a presentation request when iss matches didDocument.id', () => {
        subject = new PresentationRequestByDeepLinkVerifierImpl();
        const presentationRequestWithDidDocumentId = createPresentationRequest(
            DidDocumentMocks.DidDocumentMock.id,
        );

        expect(() =>
            subject.verifyPresentationRequest(
                presentationRequestWithDidDocumentId,
                deepLink,
                DidDocumentMocks.DidDocumentMock,
            ),
        ).not.toThrow();
    });

    test('verifies a presentation request when inspectorDid matches didDocument.id', () => {
        subject = new PresentationRequestByDeepLinkVerifierImpl();
        const deepLinkWithDidDocumentId = new VCLDeepLink(
            `velocity-network://inspect?inspectorDid=${encodeURIComponent(
                DidDocumentMocks.DidDocumentMock.id,
            )}`,
        );

        expect(() =>
            subject.verifyPresentationRequest(
                presentationRequest,
                deepLinkWithDidDocumentId,
                DidDocumentMocks.DidDocumentMock,
            ),
        ).not.toThrow();
    });

    test('throws for a mismatched presentation request deep link', () => {
        subject = new PresentationRequestByDeepLinkVerifierImpl();

        try {
            subject.verifyPresentationRequest(
                presentationRequest,
                deepLink,
                DidDocumentMocks.DidDocumentWithWrongDidMock,
            );
        } catch (error) {
            expect(error).toMatchObject({
                errorCode:
                    VCLErrorCode.MismatchedPresentationRequestInspectorDid,
            });
            return;
        }
        throw new Error('Expected presentation request verification to throw');
    });
});
