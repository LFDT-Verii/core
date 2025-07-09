/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';
import VCLJwtVerifiableCredentials from '../../../api/entities/VCLJwtVerifiableCredentials';
import VCLJwt from '../../../api/entities/VCLJwt';

export default interface CredentialDidVerifier {
    verifyCredentials(
        jwtCredentials: VCLJwt[],
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor
    ): Promise<VCLJwtVerifiableCredentials>;
}
