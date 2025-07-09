/**
 * Created by Michael Avoyan on 21/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import CredentialIssuerVerifier from '../../domain/verifiers/CredentialIssuerVerifier';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';

export default class CredentialIssuerVerifierEmptyImpl
    implements CredentialIssuerVerifier
{
    async verifyCredentials(
        jwtCredentials: VCLJwt[],
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor
    ): Promise<boolean> {
        return true;
    }
}
