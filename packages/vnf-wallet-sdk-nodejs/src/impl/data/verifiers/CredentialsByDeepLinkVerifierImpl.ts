/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLDeepLink from '../../../api/entities/VCLDeepLink';
import CredentialsByDeepLinkVerifier from '../../domain/verifiers/CredentialsByDeepLinkVerifier';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLLog from '../../utils/VCLLog';
import VCLError from '../../../api/entities/error/VCLError';
import VCLErrorCode from '../../../api/entities/error/VCLErrorCode';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';
import ResolveDidDocumentRepository from '../../domain/repositories/ResolveDidDocumentRepository';

export default class CredentialsByDeepLinkVerifierImpl
    implements CredentialsByDeepLinkVerifier
{
    constructor(
        private readonly resolveDidDocumentRepository: ResolveDidDocumentRepository
    ) {}

    async verifyCredentials(
        jwtCredentials: VCLJwt[],
        deepLink: VCLDeepLink
    ): Promise<boolean> {
        if (deepLink.did === null) {
            await this.onError(`DID not found in deep link: ${deepLink.value}`);
            return false;
        }
        const didDocument =
            await this.resolveDidDocumentRepository.resolveDidDocument(
                deepLink.did!
            );
        return this.verify(jwtCredentials, didDocument);
    }

    private async verify(
        jwtCredentials: VCLJwt[],
        didDocument: VCLDidDocument
    ): Promise<boolean> {
        const mismatchedCredential = jwtCredentials.find(
            (credential) =>
                didDocument.id !== credential.iss &&
                !didDocument.alsoKnownAs.includes(credential.iss ?? '')
        );

        if (mismatchedCredential) {
            await this.onError(
                `mismatched credential: ${mismatchedCredential.encodedJwt} \ndidDocument: ${didDocument}`,
                VCLErrorCode.MismatchedCredentialIssuerDid
            );
        } else {
            return true;
        }
        return false;
    }

    private async onError(
        errorMessage: string,
        errorCode: VCLErrorCode = VCLErrorCode.SdkError
    ) {
        VCLLog.error(errorMessage);
        throw new VCLError(null, errorCode, null, errorMessage);
    }
}
