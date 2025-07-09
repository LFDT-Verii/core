/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLCredentialManifest from './entities/VCLCredentialManifest';
import VCLCredentialManifestDescriptor from './entities/VCLCredentialManifestDescriptor';
import VCLCredentialTypesUIFormSchema from './entities/VCLCredentialTypesUIFormSchema';
import VCLCredentialTypesUIFormSchemaDescriptor from './entities/VCLCredentialTypesUIFormSchemaDescriptor';
import VCLDidJwk from './entities/VCLDidJwk';
import VCLError from './entities/error/VCLError';
import VCLExchange from './entities/VCLExchange';
import VCLExchangeDescriptor from './entities/VCLExchangeDescriptor';
import VCLFinalizeOffersDescriptor from './entities/VCLFinalizeOffersDescriptor';
import VCLGenerateOffersDescriptor from './entities/VCLGenerateOffersDescriptor';
import VCLInitializationDescriptor from './entities/initialization/VCLInitializationDescriptor';
import VCLPublicJwk from './entities/VCLPublicJwk';
import VCLJwt from './entities/VCLJwt';
import VCLJwtDescriptor from './entities/VCLJwtDescriptor';
import VCLJwtVerifiableCredentials from './entities/VCLJwtVerifiableCredentials';
import VCLOffers from './entities/VCLOffers';
import VCLOrganizations from './entities/VCLOrganizations';
import { VCLOrganizationsSearchDescriptor } from './entities/VCLOrganizationsSearchDescriptor';
import VCLPresentationRequest from './entities/VCLPresentationRequest';
import VCLPresentationRequestDescriptor from './entities/VCLPresentationRequestDescriptor';
import VCLPresentationSubmission from './entities/VCLPresentationSubmission';
import VCLSubmissionResult from './entities/VCLSubmissionResult';
import VCLToken from './entities/VCLToken';
import VCLVerifiedProfile from './entities/VCLVerifiedProfile';
import VCLVerifiedProfileDescriptor from './entities/VCLVerifiedProfileDescriptor';
import { Nullish } from './VCLTypes';
import VCLDidJwkDescriptor from './entities/VCLDidJwkDescriptor';
import VCLCountries from './entities/VCLCountries';
import VCLCredentialTypes from './entities/VCLCredentialTypes';
import VCLCredentialTypeSchemas from './entities/VCLCredentialTypeSchemas';
import VCLAuthTokenDescriptor from './entities/VCLAuthTokenDescriptor';
import VCLAuthToken from './entities/VCLAuthToken';

export default interface VCL {
    initialize(
        initializationDescriptor: VCLInitializationDescriptor
    ): Promise<Nullish<VCLError>>;

    get countries(): Nullish<VCLCountries>;

    get credentialTypes(): Nullish<VCLCredentialTypes>;

    get credentialTypeSchemas(): Nullish<VCLCredentialTypeSchemas>;

    getPresentationRequest(
        presentationRequestDescriptor: VCLPresentationRequestDescriptor
    ): Promise<VCLPresentationRequest>;

    submitPresentation(
        presentationSubmission: VCLPresentationSubmission,
        authToken?: Nullish<VCLAuthToken>
    ): Promise<VCLSubmissionResult>;

    getExchangeProgress(
        exchangeDescriptor: VCLExchangeDescriptor
    ): Promise<VCLExchange>;

    searchForOrganizations(
        organizationsSearchDescriptor: VCLOrganizationsSearchDescriptor
    ): Promise<VCLOrganizations>;

    getCredentialManifest(
        credentialManifestDescriptor: VCLCredentialManifestDescriptor
    ): Promise<VCLCredentialManifest>;

    generateOffers(
        generateOffersDescriptor: VCLGenerateOffersDescriptor
    ): Promise<VCLOffers>;

    checkForOffers(
        generateOffersDescriptor: VCLGenerateOffersDescriptor,
        sessionToken: VCLToken
    ): Promise<VCLOffers>;

    finalizeOffers(
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor,
        sessionToken: VCLToken
    ): Promise<VCLJwtVerifiableCredentials>;

    getAuthToken(
        authTokenDescriptor: VCLAuthTokenDescriptor
    ): Promise<VCLAuthToken>;

    getCredentialTypesUIFormSchema(
        credentialTypesUIFormSchemaDescriptor: VCLCredentialTypesUIFormSchemaDescriptor
    ): Promise<VCLCredentialTypesUIFormSchema>;

    getVerifiedProfile(
        verifiedProfileDescriptor: VCLVerifiedProfileDescriptor
    ): Promise<VCLVerifiedProfile>;

    verifyJwt(
        jwt: VCLJwt,
        publicJwk: Nullish<VCLPublicJwk>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<boolean>;

    generateSignedJwt(
        jwtDescriptor: VCLJwtDescriptor,
        didJwk: VCLDidJwk,
        nonce: Nullish<string>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<VCLJwt>;

    generateDidJwk(didJwkDescriptor: VCLDidJwkDescriptor): Promise<VCLDidJwk>;
}
