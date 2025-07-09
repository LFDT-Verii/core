/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { verifyIssuerForCredentialType } from '@verii/vc-checks';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';
import CredentialIssuerVerifier from '../../domain/verifiers/CredentialIssuerVerifier';
import { loadJsonldContext } from '../../utils/LoadJsonldContext';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import CredentialTypesModel from '../../domain/models/CredentialTypesModel';
import { getCredentialTypeMetadataByVc } from './VerificationUtils';

export default class CredentialIssuerVerifierImpl
    implements CredentialIssuerVerifier
{
    constructor(
        private credentialTypesModel: CredentialTypesModel,
        private networkService: NetworkService
    ) {}

    async verifyCredentials(
        jwtCredentials: VCLJwt[],
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor
    ): Promise<boolean> {
        const verifiedPromises = jwtCredentials.map(async (jwtCredential) => {
            const jsonLdContext = await loadJsonldContext(
                jwtCredential.payload.vc,
                this.networkService
            );
            const credentialTypeMetadata = getCredentialTypeMetadataByVc(
                this.credentialTypesModel.data,
                jwtCredential
            );
            return verifyIssuerForCredentialType(
                jwtCredential.payload.vc,
                finalizeOffersDescriptor.credentialManifest.issuerId,
                {
                    issuerAccreditation:
                        finalizeOffersDescriptor.credentialManifest
                            .verifiedProfile.credentialSubject,
                    credentialTypeMetadata,
                    jsonLdContext,
                },
                {
                    log: console,
                    config: {},
                }
            );
        });
        const verified = await Promise.all(verifiedPromises);
        return verified.every((v) => v);
    }
}
