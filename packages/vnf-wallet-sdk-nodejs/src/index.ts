/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import VCLProvider from './api/VCLProvider';
import VCLSignatureAlgorithm from './api/VCLSignatureAlgorithm';
import type VCL from './api/VCL';
import VCLInitializationDescriptor from './api/entities/initialization/VCLInitializationDescriptor';
import VCLCryptoServicesDescriptor from './api/entities/initialization/VCLCryptoServicesDescriptor';
import type VCLKeyService from './api/keys/VCLKeyService';
import type VCLJwtSignService from './api/jwt/VCLJwtSignService';
import type VCLJwtVerifyService from './api/jwt/VCLJwtVerifyService';
import VCLEnvironment, { environmentFromString } from './api/VCLEnvironment';
import VCLXVnfProtocolVersion, {
    vnfProtocolVersionFromString,
} from './api/VCLXVnfProtocolVersion';
import VCLCountry from './api/entities/VCLCountry';
import VCLCountries from './api/entities/VCLCountries';
import VCLCountryCodes from './api/entities/VCLCountryCodes';
import VCLRegion from './api/entities/VCLRegion';
import VCLRegions from './api/entities/VCLRegions';
import VCLCredentialManifest from './api/entities/VCLCredentialManifest';
import VCLCredentialManifestDescriptor from './api/entities/VCLCredentialManifestDescriptor';
import VCLCredentialManifestDescriptorByDeepLink from './api/entities/VCLCredentialManifestDescriptorByDeepLink';
import VCLCredentialManifestDescriptorByService from './api/entities/VCLCredentialManifestDescriptorByService';
import VCLCredentialManifestDescriptorRefresh from './api/entities/VCLCredentialManifestDescriptorRefresh';
import VCLCredentialType from './api/entities/VCLCredentialType';
import VCLCredentialTypes from './api/entities/VCLCredentialTypes';
import VCLCredentialTypeSchema from './api/entities/VCLCredentialTypeSchema';
import VCLCredentialTypeSchemas from './api/entities/VCLCredentialTypeSchemas';
import VCLCredentialTypesUIFormSchemaDescriptor from './api/entities/VCLCredentialTypesUIFormSchemaDescriptor';
import VCLCredentialTypesUIFormSchema from './api/entities/VCLCredentialTypesUIFormSchema';
import VCLDeepLink from './api/entities/VCLDeepLink';
import VCLExchange from './api/entities/VCLExchange';
import VCLExchangeDescriptor from './api/entities/VCLExchangeDescriptor';
import VCLFinalizeOffersDescriptor from './api/entities/VCLFinalizeOffersDescriptor';
import VCLGenerateOffersDescriptor from './api/entities/VCLGenerateOffersDescriptor';
import VCLJwt from './api/entities/VCLJwt';
import VCLJwtVerifiableCredentials from './api/entities/VCLJwtVerifiableCredentials';
import VCLOffer from './api/entities/VCLOffer';
import VCLOffers from './api/entities/VCLOffers';
import VCLOrganization from './api/entities/VCLOrganization';
import VCLOrganizations from './api/entities/VCLOrganizations';
import {
    VCLOrganizationsSearchDescriptor,
    VCLFilter,
    VCLPage,
} from './api/entities/VCLOrganizationsSearchDescriptor';
import VCLPresentationRequest from './api/entities/VCLPresentationRequest';
import VCLPresentationSubmission from './api/entities/VCLPresentationSubmission';
import VCLPublicJwk from './api/entities/VCLPublicJwk';
import VCLPushDelegate from './api/entities/VCLPushDelegate';
import VCLService from './api/entities/VCLService';
import VCLServiceType from './api/entities/VCLServiceType';
import VCLServiceTypes from './api/entities/VCLServiceTypes';
import {
    VCLIssuingType,
    issuingTypeFromString,
} from './api/entities/VCLIssuingType';
import VCLSubmissionResult from './api/entities/VCLSubmissionResult';
import VCLToken from './api/entities/VCLToken';
import VCLVerifiableCredential from './api/entities/VCLVerifiableCredential';
import VCLVerifiedProfile from './api/entities/VCLVerifiedProfile';
import VCLVerifiedProfileDescriptor from './api/entities/VCLVerifiedProfileDescriptor';
import VCLPresentationRequestDescriptor from './api/entities/VCLPresentationRequestDescriptor';
import VCLJwtDescriptor from './api/entities/VCLJwtDescriptor';
import VCLDidJwkDescriptor from './api/entities/VCLDidJwkDescriptor';
import VCLDidJwk from './api/entities/VCLDidJwk';
import VCLError from './api/entities/error/VCLError';
import VCLStatusCode from './api/entities/error/VCLStatusCode';
import VCLErrorCode from './api/entities/error/VCLErrorCode';
import {
    VCLLogService,
    LogFn,
} from './api/entities/initialization/VCLLogService';
import type { Nullish, Dictionary } from './api/VCLTypes';
import VCLAuthToken from './api/entities/VCLAuthToken';
import VCLAuthTokenDescriptor from './api/entities/VCLAuthTokenDescriptor';

export type {
    VCL,
    VCLKeyService,
    VCLJwtSignService,
    VCLJwtVerifyService,
    Nullish,
    Dictionary,
    VCLLogService,
    LogFn,
};

export {
    VCLProvider,
    VCLSignatureAlgorithm,
    VCLInitializationDescriptor,
    VCLCryptoServicesDescriptor,
    VCLEnvironment,
    VCLXVnfProtocolVersion,
    VCLStatusCode,
    VCLErrorCode,
    VCLServiceType,
    VCLServiceTypes,
    VCLIssuingType,
    issuingTypeFromString,
    VCLCountryCodes,
    VCLError,
    VCLCountry,
    VCLCountries,
    VCLRegion,
    VCLRegions,
    VCLCredentialManifest,
    VCLCredentialManifestDescriptor,
    VCLCredentialManifestDescriptorByDeepLink,
    VCLCredentialManifestDescriptorByService,
    VCLCredentialType,
    VCLCredentialTypes,
    VCLCredentialTypeSchema,
    VCLCredentialTypeSchemas,
    VCLCredentialTypesUIFormSchema,
    VCLCredentialTypesUIFormSchemaDescriptor,
    VCLCredentialManifestDescriptorRefresh,
    VCLDeepLink,
    VCLExchange,
    VCLExchangeDescriptor,
    VCLFinalizeOffersDescriptor,
    VCLGenerateOffersDescriptor,
    VCLJwt,
    VCLJwtVerifiableCredentials,
    VCLOffer,
    VCLOffers,
    VCLOrganization,
    VCLOrganizations,
    VCLOrganizationsSearchDescriptor,
    VCLFilter,
    VCLPage,
    VCLPresentationRequest,
    VCLPresentationSubmission,
    VCLPublicJwk,
    VCLPushDelegate,
    VCLService,
    VCLSubmissionResult,
    VCLToken,
    VCLVerifiableCredential,
    VCLVerifiedProfile,
    VCLVerifiedProfileDescriptor,
    VCLPresentationRequestDescriptor,
    VCLJwtDescriptor,
    VCLDidJwkDescriptor,
    VCLDidJwk,
    vnfProtocolVersionFromString,
    environmentFromString,
    VCLAuthToken,
    VCLAuthTokenDescriptor,
};
