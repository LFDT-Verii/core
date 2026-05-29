/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLPresentationRequest from '../../../api/entities/VCLPresentationRequest';
import VCLDeepLink from '../../../api/entities/VCLDeepLink';
import PresentationRequestByDeepLinkVerifier from '../../domain/verifiers/PresentationRequestByDeepLinkVerifier';
import VCLErrorCode from '../../../api/entities/error/VCLErrorCode';
import VCLError from '../../../api/entities/error/VCLError';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';

export default class PresentationRequestByDeepLinkVerifierImpl implements PresentationRequestByDeepLinkVerifier {
    verifyPresentationRequest(
        presentationRequest: VCLPresentationRequest,
        deepLink: VCLDeepLink,
        didDocument: VCLDidDocument,
    ): void {
        const deepLinkDid = deepLink.did;

        if (deepLinkDid == null) {
            throw new VCLError({
                errorCode: VCLErrorCode.SdkError.toString(),
                message: `DID not found in deep link: ${deepLink.value}`,
            });
        }
        if (
            !(
                this.isDidBoundToDidDocument(
                    presentationRequest.iss,
                    didDocument,
                ) && this.isDidBoundToDidDocument(deepLinkDid, didDocument)
            )
        ) {
            throw new VCLError({
                errorCode:
                    VCLErrorCode.MismatchedPresentationRequestInspectorDid.toString(),
                message: `mismatched presentation request: ${presentationRequest.jwt.encodedJwt} \ndidDocument: ${didDocument}`,
            });
        }
    }

    private isDidBoundToDidDocument(did: string, didDocument: VCLDidDocument) {
        return didDocument.id === did || didDocument.alsoKnownAs.includes(did);
    }
}
