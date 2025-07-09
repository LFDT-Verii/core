/**
 * Created by Michael Avoyan on 05/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { CredentialManifestDescriptorMocks } from '../infrastructure/resources/valid/CredentialManifestDescriptorMocks';
import { VCLErrorCode, VCLJwt } from '../../src';
import { CredentialsByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import CredentialsByDeepLinkVerifier from '../../src/impl/domain/verifiers/CredentialsByDeepLinkVerifier';
import { CredentialMocks } from '../infrastructure/resources/valid/CredentialMocks';

describe('CredentialsByDeepLinkVerifier', () => {
    let subject: CredentialsByDeepLinkVerifier;

    const deepLink = CredentialManifestDescriptorMocks.DeepLink;
    const credentials = [
        VCLJwt.fromEncodedJwt(
            CredentialMocks.JwtCredentialEmploymentPastFromRegularIssuer
        ),
        VCLJwt.fromEncodedJwt(
            CredentialMocks.JwtCredentialEducationDegreeRegistrationFromRegularIssuer
        ),
    ];

    test('testVerifyCredentialsSuccess', async () => {
        subject = new CredentialsByDeepLinkVerifierImpl(
            new ResolveDidDocumentRepositoryImpl(
                new NetworkServiceSuccess(DidDocumentMocks.DidDocumentMock)
            )
        );

        const isVerified = await subject.verifyCredentials(
            credentials,
            deepLink
        );
        expect(isVerified).toBeTruthy();
    });

    test('testVerifyCredentialsError', async () => {
        subject = new CredentialsByDeepLinkVerifierImpl(
            new ResolveDidDocumentRepositoryImpl(
                new NetworkServiceSuccess(
                    DidDocumentMocks.DidDocumentWithWrongDidMock
                )
            )
        );
        try {
            const isVerified = await subject.verifyCredentials(
                credentials,
                deepLink
            );
            expect(isVerified).toBeFalsy();
        } catch (error: any) {
            expect(error.errorCode).toEqual(
                VCLErrorCode.MismatchedCredentialIssuerDid
            );
        }
    });
});
