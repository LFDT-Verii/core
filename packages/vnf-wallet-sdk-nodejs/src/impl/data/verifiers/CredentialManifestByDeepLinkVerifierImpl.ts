/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLCredentialManifest from '../../../api/entities/VCLCredentialManifest';
import VCLDeepLink from '../../../api/entities/VCLDeepLink';
import CredentialManifestByDeepLinkVerifier from '../../domain/verifiers/CredentialManifestByDeepLinkVerifier';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';
import VCLError from '../../../api/entities/error/VCLError';
import VCLErrorCode from '../../../api/entities/error/VCLErrorCode';

export default class CredentialManifestByDeepLinkVerifierImpl implements CredentialManifestByDeepLinkVerifier {
    verifyCredentialManifest(
        credentialManifest: VCLCredentialManifest,
        deepLink: VCLDeepLink,
        didDocument: VCLDidDocument,
    ): void {
        if (!(
            (didDocument.id === credentialManifest.issuerId &&
                didDocument.id === deepLink.did) ||
            (didDocument.alsoKnownAs.includes(credentialManifest.issuerId) &&
                didDocument.alsoKnownAs.includes(deepLink.did!))
        )) {
            throw new VCLError({
                errorCode: VCLErrorCode.MismatchedRequestIssuerDid.toString(),
                message: `credential manifest: ${credentialManifest.jwt.encodedJwt} \ndidDocument: ${didDocument}`,
            });
        }
    }
}
