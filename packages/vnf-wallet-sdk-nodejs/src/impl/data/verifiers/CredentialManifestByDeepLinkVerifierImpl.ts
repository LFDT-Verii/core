/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLCredentialManifest from '../../../api/entities/VCLCredentialManifest';
import VCLDeepLink from '../../../api/entities/VCLDeepLink';
import CredentialManifestByDeepLinkVerifier from '../../domain/verifiers/CredentialManifestByDeepLinkVerifier';
import VCLLog from '../../utils/VCLLog';
import VCLError from '../../../api/entities/error/VCLError';
import VCLErrorCode from '../../../api/entities/error/VCLErrorCode';
import ResolveDidDocumentRepository from '../../domain/repositories/ResolveDidDocumentRepository';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';

export default class CredentialManifestByDeepLinkVerifierImpl
    implements CredentialManifestByDeepLinkVerifier
{
    async verifyCredentialManifest(
        credentialManifest: VCLCredentialManifest,
        deepLink: VCLDeepLink,
        didDocument: VCLDidDocument
    ): Promise<boolean> {
        if (deepLink.did === null) {
            await this.onError(`DID not found in deep link: ${deepLink.value}`);
            return false;
        }
        if (
            (didDocument.id === credentialManifest.issuerId &&
                didDocument.id === deepLink.did) ||
            (didDocument.alsoKnownAs.includes(credentialManifest.issuerId) &&
                didDocument.alsoKnownAs.includes(deepLink.did!))
        ) {
            return true;
        }
        await this.onError(
            `credential manifest: ${credentialManifest.jwt.encodedJwt} \ndidDocument: ${didDocument}`,
            VCLErrorCode.MismatchedRequestIssuerDid
        );
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
