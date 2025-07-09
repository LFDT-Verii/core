import { randomUUID } from 'crypto';
import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLJwtVerifiableCredentials from '../../../api/entities/VCLJwtVerifiableCredentials';
import VCLToken from '../../../api/entities/VCLToken';
import FinalizeOffersRepository from '../../domain/repositories/FinalizeOffersRepository';
import JwtServiceRepository from '../../domain/repositories/JwtServiceRepository';
import FinalizeOffersUseCase from '../../domain/usecases/FinalizeOffersUseCase';
import VCLError from '../../../api/entities/error/VCLError';
import CredentialDidVerifier from '../../domain/verifiers/CredentialDidVerifier';
import CredentialsByDeepLinkVerifier from '../../domain/verifiers/CredentialsByDeepLinkVerifier';
import CredentialIssuerVerifier from '../../domain/verifiers/CredentialIssuerVerifier';
import VCLJwtDescriptor from '../../../api/entities/VCLJwtDescriptor';
import { Nullish } from '../../../api/VCLTypes';

export default class FinalizeOffersUseCaseImpl
    implements FinalizeOffersUseCase
{
    constructor(
        private finalizeOffersRepository: FinalizeOffersRepository,
        private jwtServiceRepository: JwtServiceRepository,
        private credentialIssuerVerifier: CredentialIssuerVerifier,
        private credentialDidVerifier: CredentialDidVerifier,
        private credentialsByDeepLinkVerifier: CredentialsByDeepLinkVerifier
    ) {}

    async finalizeOffers(
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor,
        sessionToken: VCLToken
    ): Promise<VCLJwtVerifiableCredentials> {
        try {
            if (finalizeOffersDescriptor.challenge) {
                const proof = await this.jwtServiceRepository.generateSignedJwt(
                    new VCLJwtDescriptor(
                        null,
                        randomUUID().toString(),
                        finalizeOffersDescriptor.didJwk.did,
                        finalizeOffersDescriptor.aud
                    ),
                    finalizeOffersDescriptor.didJwk,
                    finalizeOffersDescriptor.challenge,
                    finalizeOffersDescriptor.remoteCryptoServicesToken
                );
                return await this.finalizeOffersInvoke(
                    finalizeOffersDescriptor,
                    sessionToken,
                    proof
                );
            }
            return await this.finalizeOffersInvoke(
                finalizeOffersDescriptor,
                sessionToken
            );
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }

    async finalizeOffersInvoke(
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor,
        sessionToken: VCLToken,
        proof: Nullish<VCLJwt> = null
    ): Promise<VCLJwtVerifiableCredentials> {
        const jwtCredentials =
            await this.finalizeOffersRepository.finalizeOffers(
                finalizeOffersDescriptor,
                sessionToken,
                proof
            );
        if (
            await this.verifyCredentialsByDeepLink(
                jwtCredentials,
                finalizeOffersDescriptor
            )
        ) {
            if (
                await this.verifyCredentialsByIssuer(
                    jwtCredentials,
                    finalizeOffersDescriptor
                )
            ) {
                return this.verifyCredentialByDid(
                    jwtCredentials,
                    finalizeOffersDescriptor
                );
            }
        }
        throw new VCLError('Credentials verification failed');
    }

    async verifyCredentialsByDeepLink(
        jwtCredentials: VCLJwt[],
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor
    ): Promise<boolean> {
        const { deepLink } = finalizeOffersDescriptor.credentialManifest;
        if (deepLink) {
            return this.credentialsByDeepLinkVerifier.verifyCredentials(
                jwtCredentials,
                deepLink
            );
        }
        // Deep link was not provided => nothing to verify
        return true;
    }

    async verifyCredentialsByIssuer(
        jwtCredentials: VCLJwt[],
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor
    ): Promise<boolean> {
        return this.credentialIssuerVerifier.verifyCredentials(
            jwtCredentials,
            finalizeOffersDescriptor
        );
    }

    async verifyCredentialByDid(
        encodedJwtCredentialsList: VCLJwt[],
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor
    ): Promise<VCLJwtVerifiableCredentials> {
        return this.credentialDidVerifier.verifyCredentials(
            encodedJwtCredentialsList,
            finalizeOffersDescriptor
        );
    }
}
