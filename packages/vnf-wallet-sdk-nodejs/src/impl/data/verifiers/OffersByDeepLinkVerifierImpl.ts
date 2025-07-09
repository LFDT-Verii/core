/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLOffers from '../../../api/entities/VCLOffers';
import VCLDeepLink from '../../../api/entities/VCLDeepLink';
import OffersByDeepLinkVerifier from '../../domain/verifiers/OffersByDeepLinkVerifier';
import VCLErrorCode from '../../../api/entities/error/VCLErrorCode';
import VCLError from '../../../api/entities/error/VCLError';
import VCLLog from '../../utils/VCLLog';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';
import ResolveDidDocumentRepository from '../../domain/repositories/ResolveDidDocumentRepository';

export default class OffersByDeepLinkVerifierImpl
    implements OffersByDeepLinkVerifier
{
    constructor(
        private readonly resolveDidDocumentRepository: ResolveDidDocumentRepository
    ) {}

    async verifyOffers(
        offers: VCLOffers,
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
        return this.verify(offers, didDocument);
    }

    private async verify(
        offers: VCLOffers,
        didDocument: VCLDidDocument
    ): Promise<boolean> {
        const mismatchedOffer = offers.all.find(
            (offer) =>
                didDocument.id !== offer.issuerId &&
                !didDocument.alsoKnownAs.includes(offer.issuerId ?? '')
        );

        if (mismatchedOffer) {
            await this.onError(
                `mismatched credential: ${mismatchedOffer} \ndidDocument: ${didDocument}`,
                VCLErrorCode.MismatchedOfferIssuerDid
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
