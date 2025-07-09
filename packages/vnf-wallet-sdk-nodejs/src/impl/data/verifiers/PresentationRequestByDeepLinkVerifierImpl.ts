/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLPresentationRequest from '../../../api/entities/VCLPresentationRequest';
import VCLDeepLink from '../../../api/entities/VCLDeepLink';
import PresentationRequestByDeepLinkVerifier from '../../domain/verifiers/PresentationRequestByDeepLinkVerifier';
import VCLLog from '../../utils/VCLLog';
import VCLErrorCode from '../../../api/entities/error/VCLErrorCode';
import VCLError from '../../../api/entities/error/VCLError';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';

export default class PresentationRequestByDeepLinkVerifierImpl
    implements PresentationRequestByDeepLinkVerifier
{
    async verifyPresentationRequest(
        presentationRequest: VCLPresentationRequest,
        deepLink: VCLDeepLink,
        didDocument: VCLDidDocument
    ): Promise<boolean> {
        if (deepLink.did === null) {
            await this.onError(`DID not found in deep link: ${deepLink.value}`);
            return false;
        }
        if (
            (didDocument.id === presentationRequest.iss &&
                didDocument.id === deepLink.did) ||
            (didDocument.alsoKnownAs.includes(presentationRequest.iss) &&
                didDocument.alsoKnownAs.includes(deepLink.did!))
        ) {
            return true;
        }
        await this.onError(
            `mismatched presentation request: ${presentationRequest.jwt.encodedJwt} \ndidDocument: ${didDocument}`,
            VCLErrorCode.MismatchedPresentationRequestInspectorDid
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
