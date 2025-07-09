/**
 * Created by Michael Avoyan on 05/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import CredentialManifestByDeepLinkVerifier from '../../src/impl/domain/verifiers/CredentialManifestByDeepLinkVerifier';
import {
    VCLCredentialManifest,
    VCLErrorCode,
    VCLJwt,
    VCLVerifiedProfile,
} from '../../src';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { CredentialManifestDescriptorMocks } from '../infrastructure/resources/valid/CredentialManifestDescriptorMocks';
import { CredentialManifestByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';

describe('CredentialManifestByDeepLinkVerifier', () => {
    let subject: CredentialManifestByDeepLinkVerifier;

    const deepLink = CredentialManifestDescriptorMocks.DeepLink;

    const credentialManifest = new VCLCredentialManifest(
        VCLJwt.fromEncodedJwt(CredentialManifestMocks.JwtCredentialManifest1),
        null,
        new VCLVerifiedProfile(
            JSON.parse(VerifiedProfileMocks.VerifiedProfileOfRegularIssuer)
        ),
        deepLink,
        DidJwkMocks.DidJwk
    );

    test('testVerifyCredentialManifestSuccess', async () => {
        subject = new CredentialManifestByDeepLinkVerifierImpl();

        const isVerified = await subject.verifyCredentialManifest(
            credentialManifest,
            deepLink,
            DidDocumentMocks.DidDocumentMock
        );
        expect(isVerified).toBeTruthy();
    });

    test('testVerifyCredentialManifestError', async () => {
        subject = new CredentialManifestByDeepLinkVerifierImpl();
        try {
            const isVerified = await subject.verifyCredentialManifest(
                credentialManifest,
                deepLink,
                DidDocumentMocks.DidDocumentWithWrongDidMock
            );
            expect(isVerified).toBeFalsy();
        } catch (error: any) {
            expect(error.errorCode).toEqual(
                VCLErrorCode.MismatchedRequestIssuerDid
            );
        }
    });
});
