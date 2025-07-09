/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import VCLCredentialTypes from '../api/entities/VCLCredentialTypes';
import VCLCryptoServicesDescriptor from '../api/entities/initialization/VCLCryptoServicesDescriptor';
import NetworkServiceImpl from './data/infrastructure/network/NetworkServiceImpl';
import CountriesModelImpl from './data/models/CountriesModelImpl';
import CredentialTypeSchemasModelImpl from './data/models/CredentialTypeSchemasModelImpl';
import CredentialTypesModelImpl from './data/models/CredentialTypesModelImpl';
import CountriesRepositoryImpl from './data/repositories/CountriesRepositoryImpl';
import CredentialManifestRepositoryImpl from './data/repositories/CredentialManifestRepositoryImpl';
import CredentialTypeSchemaRepositoryImpl from './data/repositories/CredentialTypeSchemaRepositoryImpl';
import CredentialTypesRepositoryImpl from './data/repositories/CredentialTypesRepositoryImpl';
import CredentialTypesUIFormSchemaRepositoryImpl from './data/repositories/CredentialTypesUIFormSchemaRepositoryImpl';
import ExchangeProgressRepositoryImpl from './data/repositories/ExchangeProgressRepositoryImpl';
import { FinalizeOffersRepositoryImpl } from './data/repositories/FinalizeOffersRepositoryImpl';
import GenerateOffersRepositoryImpl from './data/repositories/GenerateOffersRepositoryImpl';
import IdentificationSubmissionRepositoryImpl from './data/repositories/IdentificationSubmissionRepositoryImpl';
import JwtServiceRepositoryImpl from './data/repositories/JwtServiceRepositoryImpl';
import OrganizationsRepositoryImpl from './data/repositories/OrganizationsRepositoryImpl';
import PresentationRequestRepositoryImpl from './data/repositories/PresentationRequestRepositoryImpl';
import ResolveKidRepositoryImpl from './data/repositories/ResolveKidRepositoryImpl';
import VerifiedProfileRepositoryImpl from './data/repositories/VerifiedProfileRepositoryImpl';
import CountriesUseCaseImpl from './data/usecases/CountriesModelUseCaseImpl';
import CredentialManifestUseCaseImpl from './data/usecases/CredentialManifestUseCaseImpl';
import CredentialTypeSchemasUseCaseImpl from './data/usecases/CredentialTypeSchemasUseCaseImpl';
import CredentialTypesUIFormSchemaUseCaseImpl from './data/usecases/CredentialTypesUIFormSchemaUseCaseImpl';
import CredentialTypesUseCaseImpl from './data/usecases/CredentialTypesUseCaseImpl';
import ExchangeProgressUseCaseImpl from './data/usecases/ExchangeProgressUseCaseImpl';
import FinalizeOffersUseCaseImpl from './data/usecases/FinalizeOffersUseCaseImpl';
import GenerateOffersUseCaseImpl from './data/usecases/GenerateOffersUseCaseImpl';
import IdentificationSubmissionUseCaseImpl from './data/usecases/IdentificationSubmissionUseCaseImpl';
import JwtServiceUseCaseImpl from './data/usecases/JwtServiceUseCaseImpl';
import OrganizationsUseCaseImpl from './data/usecases/OrganizationsUseCaseImpl';
import PresentationRequestUseCaseImpl from './data/usecases/PresentationRequestUseCaseImpl';
import PresentationSubmissionUseCaseImpl from './data/usecases/PresentationSubmissionUseCaseImpl';
import VerifiedProfileUseCaseImpl from './data/usecases/VerifiedProfileUseCaseImpl';
import CountriesModel from './domain/models/CountriesModel';
import CredentialTypeSchemasModel from './domain/models/CredentialTypeSchemasModel';
import CredentialTypesModel from './domain/models/CredentialTypesModel';
import CredentialManifestUseCase from './domain/usecases/CredentialManifestUseCase';
import CredentialTypesUIFormSchemaUseCase from './domain/usecases/CredentialTypesUIFormSchemaUseCase';
import ExchangeProgressUseCase from './domain/usecases/ExchangeProgressUseCase';
import FinalizeOffersUseCase from './domain/usecases/FinalizeOffersUseCase';
import GenerateOffersUseCase from './domain/usecases/GenerateOffersUseCase';
import IdentificationSubmissionUseCase from './domain/usecases/IdentificationSubmissionUseCase';
import JwtServiceUseCase from './domain/usecases/JwtServiceUseCase';
import OrganizationsUseCase from './domain/usecases/OrganizationsUseCase';
import PresentationRequestUseCase from './domain/usecases/PresentationRequestUseCase';
import PresentationSubmissionUseCase from './domain/usecases/PresentationSubmissionUseCase';
import VerifiedProfileUseCase from './domain/usecases/VerifiedProfileUseCase';
import KeyServiceUseCase from './domain/usecases/KeyServiceUseCase';
import KeyServiceUseCaseImpl from './data/usecases/KeyServiceUseCaseImpl';
import KeyServiceRepositoryImpl from './data/repositories/KeyServiceRepositoryImpl';
import {
    CredentialDidVerifierImpl,
    CredentialIssuerVerifierEmptyImpl,
    CredentialIssuerVerifierImpl,
    CredentialManifestByDeepLinkVerifierImpl,
    CredentialsByDeepLinkVerifierImpl,
    OffersByDeepLinkVerifierImpl,
    PresentationRequestByDeepLinkVerifierImpl,
} from './data/verifiers';
import CredentialIssuerVerifier from './domain/verifiers/CredentialIssuerVerifier';
import AuthTokenRepositoryImpl from './data/repositories/AuthTokenRepositoryImpl';
import AuthTokenUseCaseImpl from './data/usecases/AuthTokenUseCaseImpl';
import AuthTokenUseCase from './domain/usecases/AuthTokenUseCase';
import ResolveDidDocumentRepositoryImpl from './data/repositories/ResolveDidDocumentRepositoryImpl';

export default class VclBlocksProvider {
    static providePresentationRequestUseCase(
        cryptoServicesDescriptor: VCLCryptoServicesDescriptor
    ): PresentationRequestUseCase {
        return new PresentationRequestUseCaseImpl(
            new PresentationRequestRepositoryImpl(new NetworkServiceImpl()),
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            new JwtServiceRepositoryImpl(
                cryptoServicesDescriptor.jwtSignService,
                cryptoServicesDescriptor.jwtVerifyService
            ),
            new PresentationRequestByDeepLinkVerifierImpl()
        );
    }

    static provideVerifiedProfileUseCase(): VerifiedProfileUseCase {
        return new VerifiedProfileUseCaseImpl(
            new VerifiedProfileRepositoryImpl(new NetworkServiceImpl())
        );
    }

    static provideJwtServiceUseCase(
        cryptoServicesDescriptor: VCLCryptoServicesDescriptor
    ): JwtServiceUseCase {
        return new JwtServiceUseCaseImpl(
            new JwtServiceRepositoryImpl(
                cryptoServicesDescriptor.jwtSignService,
                cryptoServicesDescriptor.jwtVerifyService
            )
        );
    }

    static provideCredentialManifestUseCase(
        cryptoServicesDescriptor: VCLCryptoServicesDescriptor
    ): CredentialManifestUseCase {
        return new CredentialManifestUseCaseImpl(
            new CredentialManifestRepositoryImpl(new NetworkServiceImpl()),
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            new JwtServiceRepositoryImpl(
                cryptoServicesDescriptor.jwtSignService,
                cryptoServicesDescriptor.jwtVerifyService
            ),
            new CredentialManifestByDeepLinkVerifierImpl()
        );
    }

    static provideIdentificationSubmissionUseCase(
        cryptoServicesDescriptor: VCLCryptoServicesDescriptor
    ): IdentificationSubmissionUseCase {
        return new IdentificationSubmissionUseCaseImpl(
            new IdentificationSubmissionRepositoryImpl(
                new NetworkServiceImpl()
            ),
            new JwtServiceRepositoryImpl(
                cryptoServicesDescriptor.jwtSignService,
                cryptoServicesDescriptor.jwtVerifyService
            )
        );
    }

    static provideGenerateOffersUseCase(): GenerateOffersUseCase {
        return new GenerateOffersUseCaseImpl(
            new GenerateOffersRepositoryImpl(new NetworkServiceImpl()),
            new OffersByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl())
            )
        );
    }

    static provideFinalizeOffersUseCase(
        credentialTypesModel: CredentialTypesModel,
        cryptoServicesDescriptor: VCLCryptoServicesDescriptor,
        isDirectIssuerCheckOn
    ): FinalizeOffersUseCase {
        let credentialIssuerVerifier: CredentialIssuerVerifier =
            new CredentialIssuerVerifierEmptyImpl();
        if (isDirectIssuerCheckOn) {
            credentialIssuerVerifier = new CredentialIssuerVerifierImpl(
                credentialTypesModel,
                new NetworkServiceImpl()
            );
        }
        return new FinalizeOffersUseCaseImpl(
            new FinalizeOffersRepositoryImpl(new NetworkServiceImpl()),
            new JwtServiceRepositoryImpl(
                cryptoServicesDescriptor.jwtSignService,
                cryptoServicesDescriptor.jwtVerifyService
            ),
            credentialIssuerVerifier,
            new CredentialDidVerifierImpl(),
            new CredentialsByDeepLinkVerifierImpl(
                new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl())
            )
        );
    }

    static providePresentationSubmissionUseCase(
        cryptoServicesDescriptor: VCLCryptoServicesDescriptor
    ): PresentationSubmissionUseCase {
        return new PresentationSubmissionUseCaseImpl(
            new IdentificationSubmissionRepositoryImpl(
                new NetworkServiceImpl()
            ),
            new JwtServiceRepositoryImpl(
                cryptoServicesDescriptor.jwtSignService,
                cryptoServicesDescriptor.jwtVerifyService
            )
        );
    }

    static provideExchangeProgressUseCase(): ExchangeProgressUseCase {
        return new ExchangeProgressUseCaseImpl(
            new ExchangeProgressRepositoryImpl(new NetworkServiceImpl())
        );
    }

    static provideOrganizationsUseCase(): OrganizationsUseCase {
        return new OrganizationsUseCaseImpl(
            new OrganizationsRepositoryImpl(new NetworkServiceImpl())
        );
    }

    static provideCredentialTypesModel(): CredentialTypesModel {
        return new CredentialTypesModelImpl(
            new CredentialTypesUseCaseImpl(
                new CredentialTypesRepositoryImpl(new NetworkServiceImpl())
            )
        );
    }

    static provideCountriesModel(): CountriesModel {
        return new CountriesModelImpl(
            new CountriesUseCaseImpl(
                new CountriesRepositoryImpl(new NetworkServiceImpl())
            )
        );
    }

    static provideAuthTokenUseCase(): AuthTokenUseCase {
        return new AuthTokenUseCaseImpl(
            new AuthTokenRepositoryImpl(new NetworkServiceImpl())
        );
    }

    static provideCredentialTypeSchemasModel(
        credentialTypes: VCLCredentialTypes
    ): CredentialTypeSchemasModel {
        return new CredentialTypeSchemasModelImpl(
            new CredentialTypeSchemasUseCaseImpl(
                new CredentialTypeSchemaRepositoryImpl(
                    new NetworkServiceImpl()
                ),
                credentialTypes
            )
        );
    }

    static provideCredentialTypesUIFormSchemaUseCase(): CredentialTypesUIFormSchemaUseCase {
        return new CredentialTypesUIFormSchemaUseCaseImpl(
            new CredentialTypesUIFormSchemaRepositoryImpl(
                new NetworkServiceImpl()
            )
        );
    }

    static provideKeyServiceUseCase(
        cryptoServicesDescriptor: VCLCryptoServicesDescriptor
    ): KeyServiceUseCase {
        return new KeyServiceUseCaseImpl(
            new KeyServiceRepositoryImpl(cryptoServicesDescriptor.keyService)
        );
    }
}
