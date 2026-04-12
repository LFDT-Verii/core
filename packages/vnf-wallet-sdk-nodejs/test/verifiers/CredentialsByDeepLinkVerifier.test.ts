/**
 * Created by Michael Avoyan on 05/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test } from 'node:test';
import { expect } from 'expect';
import { CredentialManifestDescriptorMocks } from '../infrastructure/resources/valid/CredentialManifestDescriptorMocks';
import { VCLErrorCode, VCLJwt } from '../../src';
import { CredentialsByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import CredentialsByDeepLinkVerifier from '../../src/impl/domain/verifiers/CredentialsByDeepLinkVerifier';
import { CredentialMocks } from '../infrastructure/resources/valid/CredentialMocks';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { mockResolveDid, useNockLifecycle } from '../utils/nock';

describe('CredentialsByDeepLinkVerifier', () => {
    let subject: CredentialsByDeepLinkVerifier;

    const deepLink = CredentialManifestDescriptorMocks.DeepLink;
    const credentials = [
        VCLJwt.fromEncodedJwt(
            CredentialMocks.JwtCredentialEmploymentPastFromRegularIssuer,
        ),
        VCLJwt.fromEncodedJwt(
            CredentialMocks.JwtCredentialEducationDegreeRegistrationFromRegularIssuer,
        ),
    ];

    useNockLifecycle();

    test('verifies matching credential deep links', async () => {
        subject = new CredentialsByDeepLinkVerifierImpl(
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
        );
        const scope = mockResolveDid(
            deepLink.did!,
            DidDocumentMocks.DidDocumentMock.payload,
        );

        const isVerified = await subject.verifyCredentials(
            credentials,
            deepLink,
        );
        expect(isVerified).toBeTruthy();
        expect(scope.isDone()).toBeTruthy();
    });

    test('throws for mismatched credential deep links', async () => {
        subject = new CredentialsByDeepLinkVerifierImpl(
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
        );
        const scope = mockResolveDid(
            deepLink.did!,
            DidDocumentMocks.DidDocumentWithWrongDidMock.payload,
        );
        try {
            const isVerified = await subject.verifyCredentials(
                credentials,
                deepLink,
            );
            expect(isVerified).toBeFalsy();
        } catch (error: any) {
            expect(error.errorCode).toEqual(
                VCLErrorCode.MismatchedCredentialIssuerDid,
            );
        }
        expect(scope.isDone()).toBeTruthy();
    });
});
