/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLDeepLink from '../../../api/entities/VCLDeepLink';
import VCLOffers from '../../../api/entities/VCLOffers';

export default interface OffersByDeepLinkVerifier {
    verifyOffers(offers: VCLOffers, deepLink: VCLDeepLink): Promise<boolean>;
}
