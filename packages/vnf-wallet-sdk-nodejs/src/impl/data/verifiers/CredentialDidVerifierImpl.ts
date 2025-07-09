/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import CredentialDidVerifier from '../../domain/verifiers/CredentialDidVerifier';
import VCLJwtVerifiableCredentials from '../../../api/entities/VCLJwtVerifiableCredentials';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';

export default class CredentialDidVerifierImpl
    implements CredentialDidVerifier
{
    async verifyCredentials(
        jwtCredentials: VCLJwt[],
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor
    ): Promise<VCLJwtVerifiableCredentials> {
        const { passedCredentials, failedCredentials } = jwtCredentials.reduce(
            (acc, jwtCredential) => {
                const isValid = this.verifyCredential(
                    jwtCredential,
                    finalizeOffersDescriptor.issuerId
                );

                return isValid
                    ? {
                          passedCredentials: [
                              ...acc.passedCredentials,
                              jwtCredential,
                          ],
                          failedCredentials: acc.failedCredentials,
                      }
                    : {
                          passedCredentials: acc.passedCredentials,
                          failedCredentials: [
                              ...acc.failedCredentials,
                              jwtCredential,
                          ],
                      };
            },
            {
                passedCredentials: [] as VCLJwt[],
                failedCredentials: [] as VCLJwt[],
            }
        );

        return new VCLJwtVerifiableCredentials(
            passedCredentials,
            failedCredentials
        );
    }

    verifyCredential(jwtCredential: VCLJwt, issuerId: string): boolean {
        return jwtCredential.payload.iss === issuerId;
    }
}
