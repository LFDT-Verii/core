/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import VCL from '../api/VCL';
import VCLCountries from '../api/entities/VCLCountries';
import VCLCredentialTypes from '../api/entities/VCLCredentialTypes';
import VCLCredentialTypeSchemas from '../api/entities/VCLCredentialTypeSchemas';
import VCLCredentialManifestDescriptor from '../api/entities/VCLCredentialManifestDescriptor';
import VCLCredentialTypesUIFormSchema from '../api/entities/VCLCredentialTypesUIFormSchema';
import VCLCredentialTypesUIFormSchemaDescriptor from '../api/entities/VCLCredentialTypesUIFormSchemaDescriptor';
import VCLDidJwk from '../api/entities/VCLDidJwk';
import VCLError from '../api/entities/error/VCLError';
import VCLExchangeDescriptor from '../api/entities/VCLExchangeDescriptor';
import VCLFinalizeOffersDescriptor from '../api/entities/VCLFinalizeOffersDescriptor';
import VCLGenerateOffersDescriptor from '../api/entities/VCLGenerateOffersDescriptor';
import VCLIdentificationSubmission from '../api/entities/VCLIdentificationSubmission';
import VCLInitializationDescriptor from '../api/entities/initialization/VCLInitializationDescriptor';
import VCLPublicJwk from '../api/entities/VCLPublicJwk';
import VCLJwt from '../api/entities/VCLJwt';
import VCLJwtDescriptor from '../api/entities/VCLJwtDescriptor';
import VCLOffers from '../api/entities/VCLOffers';
import { VCLOrganizationsSearchDescriptor } from '../api/entities/VCLOrganizationsSearchDescriptor';
import VCLPresentationRequestDescriptor from '../api/entities/VCLPresentationRequestDescriptor';
import VCLPresentationSubmission from '../api/entities/VCLPresentationSubmission';
import VCLServiceType from '../api/entities/VCLServiceType';
import VCLServiceTypes from '../api/entities/VCLServiceTypes';
import VCLSubmissionResult from '../api/entities/VCLSubmissionResult';
import VCLToken from '../api/entities/VCLToken';
import VCLVerifiedProfile from '../api/entities/VCLVerifiedProfile';
import VCLVerifiedProfileDescriptor from '../api/entities/VCLVerifiedProfileDescriptor';
import GlobalConfig from './GlobalConfig';
import VclBlocksProvider from './VclBlocksProvider';
import CountriesModel from './domain/models/CountriesModel';
import CredentialTypeSchemasModel from './domain/models/CredentialTypeSchemasModel';
import CredentialTypesModel from './domain/models/CredentialTypesModel';
import InitializationWatcher from './utils/InitializationWatcher';
import { ProfileServiceTypeVerifier } from './utils/ProfileServiceTypeVerifier';
import VCLLog from './utils/VCLLog';
import VerifiedProfileUseCase from './domain/usecases/VerifiedProfileUseCase';
import JwtServiceUseCase from './domain/usecases/JwtServiceUseCase';
import IdentificationSubmissionUseCase from './domain/usecases/IdentificationSubmissionUseCase';
import PresentationRequestUseCase from './domain/usecases/PresentationRequestUseCase';
import CredentialManifestUseCase from './domain/usecases/CredentialManifestUseCase';
import GenerateOffersUseCase from './domain/usecases/GenerateOffersUseCase';
import FinalizeOffersUseCase from './domain/usecases/FinalizeOffersUseCase';
import PresentationSubmissionUseCase from './domain/usecases/PresentationSubmissionUseCase';
import ExchangeProgressUseCase from './domain/usecases/ExchangeProgressUseCase';
import OrganizationsUseCase from './domain/usecases/OrganizationsUseCase';
import CredentialTypesUIFormSchemaUseCase from './domain/usecases/CredentialTypesUIFormSchemaUseCase';
import VCLDidJwkDescriptor from '../api/entities/VCLDidJwkDescriptor';
import KeyServiceUseCase from './domain/usecases/KeyServiceUseCase';
import { Nullish } from '../api/VCLTypes';
import VCLAuthTokenDescriptor from '../api/entities/VCLAuthTokenDescriptor';
import VCLAuthToken from '../api/entities/VCLAuthToken';
import AuthTokenUseCase from './domain/usecases/AuthTokenUseCase';
import {
    toRegistrationCheckError,
    toRequestAuthorizationError,
    ErrorTaxonomy,
    RequestKind,
} from './utils/ErrorTaxonomy';
import ErrorTaxonomyCompatibilityMapper from './utils/ErrorTaxonomyCompatibilityMapper';
import PublicRequestDescriptorValidator from './utils/PublicRequestDescriptorValidator';

export class VCLImpl implements VCL {
    static readonly ModelsToInitializeAmount = 3;

    credentialTypesModel: Nullish<CredentialTypesModel>;

    initializationDescriptor!: VCLInitializationDescriptor;

    credentialTypeSchemasModel: Nullish<CredentialTypeSchemasModel>;

    countriesModel: Nullish<CountriesModel>;

    verifiedProfileUseCase!: VerifiedProfileUseCase;

    jwtServiceUseCase!: JwtServiceUseCase;

    profileServiceTypeVerifier!: ProfileServiceTypeVerifier;

    identificationUseCase!: IdentificationSubmissionUseCase;

    presentationRequestUseCase!: PresentationRequestUseCase;

    credentialManifestUseCase!: CredentialManifestUseCase;

    generateOffersUseCase!: GenerateOffersUseCase;

    finalizeOffersUseCase!: FinalizeOffersUseCase;

    presentationSubmissionUseCase!: PresentationSubmissionUseCase;

    exchangeProgressUseCase!: ExchangeProgressUseCase;

    organizationsUseCase!: OrganizationsUseCase;

    authTokenUseCase!: AuthTokenUseCase;

    credentialTypesUIFormSchemaUseCase!: CredentialTypesUIFormSchemaUseCase;

    keyServiceUseCase!: KeyServiceUseCase;

    private initializationWatcher = new InitializationWatcher(
        VCLImpl.ModelsToInitializeAmount,
    );

    private readonly presentationRequestDescriptorValidator =
        new PublicRequestDescriptorValidator({
            requestKind: ErrorTaxonomy.RequestKindPresentation,
            expectedPath: 'inspect',
            requireDeepLink: true,
        });

    private readonly credentialManifestDescriptorValidator =
        new PublicRequestDescriptorValidator({
            requestKind: ErrorTaxonomy.RequestKindIssuing,
            expectedPath: 'issue',
            requireDeepLink: false,
        });

    private readonly errorTaxonomyCompatibilityMapper =
        new ErrorTaxonomyCompatibilityMapper();

    // eslint-disable-next-line consistent-return,complexity
    async initialize(
        initializationDescriptor: VCLInitializationDescriptor,
    ): Promise<Nullish<VCLError>> {
        this.initializationDescriptor = initializationDescriptor;
        this.initializationWatcher = new InitializationWatcher(
            VCLImpl.ModelsToInitializeAmount,
        );

        this.initGlobalConfigurations(initializationDescriptor);

        this.printVersion();

        const completionHandler = (e?: any) => {
            if (e) return e;
            const firstError = this.initializationWatcher.firstError();
            if (!firstError) {
                this.initializeUseCases();
            }
            return firstError;
        };

        this.credentialTypesModel =
            VclBlocksProvider.provideCredentialTypesModel();

        this.countriesModel = VclBlocksProvider.provideCountriesModel();

        const initializeCountriesError = await this.countriesModel.initialize();
        this.initializationWatcher.onInitializedModel(initializeCountriesError);

        const initializeCredentialTypesError =
            await this.credentialTypesModel.initialize();

        if (
            initializeCredentialTypesError &&
            this.initializationWatcher.onInitializedModel(
                initializeCredentialTypesError,
                true,
            )
        ) {
            return completionHandler();
        }

        if (this.initializationWatcher.onInitializedModel(null)) {
            return completionHandler();
        }
        if (this.credentialTypesModel?.data) {
            const credentialTypes = this.credentialTypesModel.data!;
            this.credentialTypeSchemasModel =
                VclBlocksProvider.provideCredentialTypeSchemasModel(
                    credentialTypes,
                );
            await this.credentialTypeSchemasModel.initialize();

            if (
                this.initializationWatcher.onInitializedModel(
                    initializeCredentialTypesError,
                )
            ) {
                return completionHandler();
            }
        } else {
            return completionHandler(
                new VCLError({
                    message: 'Failed to get credential type schemas',
                }),
            );
        }
    }

    public initGlobalConfigurations(
        initializationDescriptor: VCLInitializationDescriptor,
    ) {
        GlobalConfig.init(
            initializationDescriptor.isDebugOn,
            initializationDescriptor.environment,
            initializationDescriptor.xVnfProtocolVersion,
            true,
        );
        VCLLog.setLoggerService(initializationDescriptor.logService);
    }

    private initializeUseCases() {
        this.verifiedProfileUseCase =
            VclBlocksProvider.provideVerifiedProfileUseCase();
        this.jwtServiceUseCase = VclBlocksProvider.provideJwtServiceUseCase(
            this.initializationDescriptor.cryptoServicesDescriptor,
        );
        this.profileServiceTypeVerifier = new ProfileServiceTypeVerifier(
            this.verifiedProfileUseCase,
        );

        this.identificationUseCase =
            VclBlocksProvider.provideIdentificationSubmissionUseCase(
                this.initializationDescriptor.cryptoServicesDescriptor,
            );

        this.presentationRequestUseCase =
            VclBlocksProvider.providePresentationRequestUseCase(
                this.initializationDescriptor.cryptoServicesDescriptor,
            );

        this.credentialManifestUseCase =
            VclBlocksProvider.provideCredentialManifestUseCase(
                this.initializationDescriptor.cryptoServicesDescriptor,
            );

        this.generateOffersUseCase =
            VclBlocksProvider.provideGenerateOffersUseCase();
        this.finalizeOffersUseCase =
            VclBlocksProvider.provideFinalizeOffersUseCase(
                this.credentialTypesModel!, // should be always initialized
                this.initializationDescriptor.cryptoServicesDescriptor,
                GlobalConfig.IsDirectIssuerOn,
            );
        this.presentationSubmissionUseCase =
            VclBlocksProvider.providePresentationSubmissionUseCase(
                this.initializationDescriptor.cryptoServicesDescriptor,
            );

        this.exchangeProgressUseCase =
            VclBlocksProvider.provideExchangeProgressUseCase();

        this.organizationsUseCase =
            VclBlocksProvider.provideOrganizationsUseCase();

        this.authTokenUseCase = VclBlocksProvider.provideAuthTokenUseCase();

        this.credentialTypesUIFormSchemaUseCase =
            VclBlocksProvider.provideCredentialTypesUIFormSchemaUseCase();

        this.keyServiceUseCase = VclBlocksProvider.provideKeyServiceUseCase(
            this.initializationDescriptor.cryptoServicesDescriptor,
        );
    }

    get countries(): Nullish<VCLCountries> {
        return this.countriesModel?.data;
    }

    get credentialTypes(): Nullish<VCLCredentialTypes> {
        return this.credentialTypesModel?.data;
    }

    get credentialTypeSchemas(): Nullish<VCLCredentialTypeSchemas> {
        return this.credentialTypeSchemasModel?.data;
    }

    getPresentationRequest = async (
        presentationRequestDescriptor: VCLPresentationRequestDescriptor,
    ) => {
        return this.withPublicRequestError(
            ErrorTaxonomy.RequestKindPresentation,
            'getPresentationRequest',
            async () => {
                this.presentationRequestDescriptorValidator.validate(
                    presentationRequestDescriptor,
                );
                const verifiedProfile =
                    await this.verifyServiceTypeOfVerifiedProfile(
                        presentationRequestDescriptor.did!,
                        new VCLServiceTypes([VCLServiceType.Inspector]),
                        ErrorTaxonomy.RequestKindPresentation,
                    );
                return this.presentationRequestUseCase.getPresentationRequest(
                    presentationRequestDescriptor,
                    verifiedProfile,
                );
            },
        );
    };

    submitPresentation = async (
        presentationSubmission: VCLPresentationSubmission,
        authToken?: Nullish<VCLAuthToken>,
    ) => {
        try {
            return await this.presentationSubmissionUseCase.submit(
                presentationSubmission,
                authToken,
            );
        } catch (error: any) {
            logError('submit presentation', error);
            throw error;
        }
    };

    getExchangeProgress = async (exchangeDescriptor: VCLExchangeDescriptor) => {
        try {
            return await this.exchangeProgressUseCase.getExchangeProgress(
                exchangeDescriptor,
            );
        } catch (error: any) {
            logError('getExchangeProgress', error);
            throw error;
        }
    };

    searchForOrganizations = async (
        organizationsSearchDescriptor: VCLOrganizationsSearchDescriptor,
    ) => {
        try {
            return await this.organizationsUseCase.searchForOrganizations(
                organizationsSearchDescriptor,
            );
        } catch (error: any) {
            logError('getExchangeProgress', error);
            throw error;
        }
    };

    getCredentialManifest = async (
        credentialManifestDescriptor: VCLCredentialManifestDescriptor,
    ) => {
        return this.withPublicRequestError(
            ErrorTaxonomy.RequestKindIssuing,
            'getCredentialManifest',
            async () => {
                this.credentialManifestDescriptorValidator.validate(
                    credentialManifestDescriptor,
                );
                const verifiedProfile =
                    await this.verifyServiceTypeOfVerifiedProfile(
                        credentialManifestDescriptor.did!,
                        VCLServiceTypes.fromIssuingType(
                            credentialManifestDescriptor.issuingType,
                        ),
                        ErrorTaxonomy.RequestKindIssuing,
                    );
                return this.credentialManifestUseCase.getCredentialManifest(
                    credentialManifestDescriptor,
                    verifiedProfile,
                );
            },
        );
    };

    generateOffers = async (
        generateOffersDescriptor: VCLGenerateOffersDescriptor,
    ) => {
        const identificationSubmission = new VCLIdentificationSubmission(
            generateOffersDescriptor.credentialManifest,
            generateOffersDescriptor.identificationVerifiableCredentials,
        );
        let identificationSubmissionResult: VCLSubmissionResult;
        try {
            identificationSubmissionResult =
                await this.identificationUseCase.submit(
                    identificationSubmission,
                );
        } catch (error: any) {
            logError('submit identification', error);
            throw error;
        }
        return this.invokeGenerateOffersUseCase(
            generateOffersDescriptor,
            identificationSubmissionResult.sessionToken,
        );
    };

    checkForOffers(
        generateOffersDescriptor: VCLGenerateOffersDescriptor,
        sessionToken: VCLToken,
    ): Promise<VCLOffers> {
        return this.invokeGenerateOffersUseCase(
            generateOffersDescriptor,
            sessionToken,
        );
    }

    getAuthToken = async (
        authTokenDescriptor: VCLAuthTokenDescriptor,
    ): Promise<VCLAuthToken> => {
        return this.authTokenUseCase.getAuthToken(authTokenDescriptor);
    };

    finalizeOffers = async (
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor,
        sessionToken: VCLToken,
    ) => {
        try {
            return await this.finalizeOffersUseCase.finalizeOffers(
                finalizeOffersDescriptor,
                sessionToken,
            );
        } catch (error: any) {
            logError('finalizeOffers', error);
            throw error;
        }
    };

    async getCredentialTypesUIFormSchema(
        credentialTypesUIFormSchemaDescriptor: VCLCredentialTypesUIFormSchemaDescriptor,
    ): Promise<VCLCredentialTypesUIFormSchema> {
        const countries = this.countriesModel?.data;
        if (countries) {
            try {
                return await this.credentialTypesUIFormSchemaUseCase.getCredentialTypesUIFormSchema(
                    credentialTypesUIFormSchemaDescriptor,
                    countries,
                );
            } catch (error: any) {
                logError('getCredentialTypesUIFormSchema', error);
                throw error;
            }
        } else {
            const error = new VCLError({
                message: 'No countries for getCredentialTypesUIFormSchema',
            });

            logError('getCredentialTypesUIFormSchema', error);
            throw error;
        }
    }

    getVerifiedProfile = async (
        verifiedProfileDescriptor: VCLVerifiedProfileDescriptor,
    ): Promise<VCLVerifiedProfile> => {
        try {
            return await this.verifiedProfileUseCase.getVerifiedProfile(
                verifiedProfileDescriptor,
            );
        } catch (error: any) {
            logError('getVerifiedProfile', error);
            throw error;
        }
    };

    verifyJwt = async (
        jwt: VCLJwt,
        publicJwk: Nullish<VCLPublicJwk>,
        remoteCryptoServicesToken: Nullish<VCLToken>,
    ) => {
        try {
            return await this.jwtServiceUseCase.verifyJwt(
                jwt,
                publicJwk,
                remoteCryptoServicesToken,
            );
        } catch (error: any) {
            logError('verifyJwt', error);
            throw error;
        }
    };

    generateSignedJwt = async (
        jwtDescriptor: VCLJwtDescriptor,
        didJwk: VCLDidJwk,
        nonce: Nullish<string>,
        remoteCryptoServicesToken: Nullish<VCLToken>,
    ) => {
        try {
            return await this.jwtServiceUseCase.generateSignedJwt(
                jwtDescriptor,
                didJwk,
                nonce,
                remoteCryptoServicesToken,
            );
        } catch (error: any) {
            logError('generateSignedJwt', error);
            throw error;
        }
    };

    generateDidJwk = async (didJwkDescriptor: VCLDidJwkDescriptor) => {
        try {
            return await this.keyServiceUseCase.generateDidJwk(
                didJwkDescriptor,
            );
        } catch (error: any) {
            logError('generateDidJwk', error);
            throw error;
        }
    };

    printVersion(): void {
        const packageJsonPath = path.resolve(__dirname, '../../package.json');
        const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, 'utf-8'),
        );
        VCLLog.info(`SDK version: ${packageJson.version}`);
    }

    private async invokeGenerateOffersUseCase(
        generateOffersDescriptor: VCLGenerateOffersDescriptor,
        sessionToken: VCLToken,
    ): Promise<VCLOffers> {
        try {
            return await this.generateOffersUseCase.generateOffers(
                generateOffersDescriptor,
                sessionToken,
            );
        } catch (error: any) {
            logError('generateOffers', error);
            throw error;
        }
    }

    private async verifyServiceTypeOfVerifiedProfile(
        did: string,
        expectedServiceTypes: VCLServiceTypes,
        requestKind: RequestKind,
    ): Promise<VCLVerifiedProfile> {
        try {
            return await this.profileServiceTypeVerifier.verifyServiceTypeOfVerifiedProfile(
                new VCLVerifiedProfileDescriptor(did),
                expectedServiceTypes,
            );
        } catch (error: any) {
            throw this.classifyProfileVerificationError(
                VCLError.fromError(error),
                requestKind,
                did,
            );
        }
    }

    private async withPublicRequestError<T>(
        requestKind: RequestKind,
        logMessage: string,
        action: () => Promise<T>,
    ): Promise<T> {
        try {
            return await action();
        } catch (error: any) {
            const sdkError = VCLError.fromError(error);
            logError(logMessage, sdkError);
            throw this.toPublicError(sdkError, requestKind);
        }
    }

    private classifyProfileVerificationError(
        error: VCLError,
        requestKind: RequestKind,
        requestDid: string | null,
    ): VCLError {
        if (
            error.sourceErrorCode ===
            ProfileServiceTypeVerifier.SourceWrongServiceType
        ) {
            return toRequestAuthorizationError(error, {
                requestKind,
                requestDid,
            });
        }
        return toRegistrationCheckError(error, { requestKind, requestDid });
    }

    private toPublicError(error: VCLError, requestKind: RequestKind): VCLError {
        if (
            this.initializationDescriptor?.errorCodeCompatibilityMode ===
            'legacy'
        ) {
            return this.errorTaxonomyCompatibilityMapper.map({
                error,
                requestKind,
                endpointNullMessage: endpointNullMessage(requestKind),
            });
        }
        return error;
    }
}

// eslint-disable-next-line default-param-last
const logError = (message = '', error: VCLError) => {
    VCLLog.error(error, message);
};

const endpointNullMessage = (requestKind: RequestKind) =>
    requestKind === ErrorTaxonomy.RequestKindPresentation
        ? 'presentationRequestDescriptor.endpoint = null'
        : 'credentialManifestDescriptor.endpoint = null';
