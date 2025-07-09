/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';

export default interface CredentialIssuerVerifier {
    verifyCredentials(
        jwtCredentials: VCLJwt[],
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor
    ): Promise<boolean>;
}
