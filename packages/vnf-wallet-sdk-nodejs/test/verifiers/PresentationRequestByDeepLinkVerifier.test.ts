/**
 * Created by Michael Avoyan on 05/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { VCLErrorCode } from '../../src';
import { PresentationRequestByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import PresentationRequestByDeepLinkVerifier from '../../src/impl/domain/verifiers/PresentationRequestByDeepLinkVerifier';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';

describe('CredentialManifestByDeepLinkVerifier', () => {
    let subject: PresentationRequestByDeepLinkVerifier;

    const presentationRequest = PresentationRequestMocks.PresentationRequest;

    const deepLink = DeepLinkMocks.PresentationRequestDeepLinkDevNet;

    test('testVerifyPresentationRequestSuccess', async () => {
        subject = new PresentationRequestByDeepLinkVerifierImpl();

        const isVerified = await subject.verifyPresentationRequest(
            presentationRequest,
            deepLink,
            DidDocumentMocks.DidDocumentMock
        );
        expect(isVerified).toBeTruthy();
    });

    test('testVerifyPresentationRequestError', async () => {
        subject = new PresentationRequestByDeepLinkVerifierImpl();
        try {
            const isVerified = await subject.verifyPresentationRequest(
                presentationRequest,
                deepLink,
                DidDocumentMocks.DidDocumentWithWrongDidMock
            );
            expect(isVerified).toBeFalsy();
        } catch (error: any) {
            expect(error.errorCode).toEqual(
                VCLErrorCode.MismatchedPresentationRequestInspectorDid
            );
        }
    });
});
