import VCLError from '../../../api/entities/error/VCLError';
import VCLPublicJwk from '../../../api/entities/VCLPublicJwk';
import VCLPresentationRequest from '../../../api/entities/VCLPresentationRequest';
import VCLPresentationRequestDescriptor from '../../../api/entities/VCLPresentationRequestDescriptor';
import JwtServiceRepository from '../../domain/repositories/JwtServiceRepository';
import PresentationRequestRepository from '../../domain/repositories/PresentationRequestRepository';
import PresentationRequestUseCase from '../../domain/usecases/PresentationRequestUseCase';
import VCLVerifiedProfile from '../../../api/entities/VCLVerifiedProfile';
import PresentationRequestByDeepLinkVerifier from '../../domain/verifiers/PresentationRequestByDeepLinkVerifier';
import ResolveDidDocumentRepository from '../../domain/repositories/ResolveDidDocumentRepository';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';
import {
    toDidResolutionError,
    toRequestValidationError,
    ErrorTaxonomy,
} from '../../utils/ErrorTaxonomy';

export default class PresentationRequestUseCaseImpl implements PresentationRequestUseCase {
    constructor(
        private presentationRequestRepository: PresentationRequestRepository,
        private resolveDidDocumentRepository: ResolveDidDocumentRepository,
        private jwtServiceRepository: JwtServiceRepository,
        private presentationRequestByDeepLinkVerifier: PresentationRequestByDeepLinkVerifier,
    ) {}

    async getPresentationRequest(
        presentationRequestDescriptor: VCLPresentationRequestDescriptor,
        verifiedProfile: VCLVerifiedProfile,
    ): Promise<VCLPresentationRequest> {
        const encodedJwtStr =
            await this.presentationRequestRepository.getPresentationRequest(
                presentationRequestDescriptor,
            );
        let requestDid = presentationRequestDescriptor.did ?? null;
        let presentationRequest: VCLPresentationRequest;
        try {
            if (!encodedJwtStr) {
                throw new VCLError({
                    message: 'Missing presentation_request',
                });
            }
            const jwt = await this.jwtServiceRepository.decode(encodedJwtStr);
            presentationRequest = new VCLPresentationRequest(
                jwt,
                verifiedProfile,
                presentationRequestDescriptor.deepLink,
                presentationRequestDescriptor.pushDelegate,
                presentationRequestDescriptor.didJwk,
                presentationRequestDescriptor.remoteCryptoServicesToken,
            );
            if (!presentationRequest.iss) {
                throw new VCLError({
                    message: 'Missing presentation_request',
                });
            }
            requestDid = presentationRequest.iss;
        } catch (error) {
            throw toRequestValidationError(VCLError.fromError(error), {
                requestKind: ErrorTaxonomy.RequestKindPresentation,
                requestDid,
            });
        }

        const didDocument = await this.resolveDidDocument(presentationRequest);
        try {
            return await this.verifyPresentationRequest(
                presentationRequest,
                didDocument,
            );
        } catch (error) {
            throw toRequestValidationError(VCLError.fromError(error), {
                requestKind: ErrorTaxonomy.RequestKindPresentation,
                requestDid,
            });
        }
    }

    private async resolveDidDocument(
        presentationRequest: VCLPresentationRequest,
    ): Promise<VCLDidDocument> {
        try {
            const didDocument =
                await this.resolveDidDocumentRepository.resolveDidDocument(
                    presentationRequest.iss,
                );
            this.validateDidDocumentVerificationMaterial(
                presentationRequest,
                didDocument,
                `public jwk not found for kid: ${presentationRequest.jwt.kid}`,
            );
            return didDocument;
        } catch (error) {
            throw toDidResolutionError(VCLError.fromError(error), {
                requestKind: ErrorTaxonomy.RequestKindPresentation,
                requestDid: presentationRequest.iss,
            });
        }
    }

    private validateDidDocumentVerificationMaterial(
        presentationRequest: VCLPresentationRequest,
        didDocument: VCLDidDocument,
        missingMaterialMessage: string,
    ) {
        const verificationMethod =
            didDocument.payload?.[VCLDidDocument.KeyVerificationMethod];
        if (
            !Array.isArray(verificationMethod) ||
            verificationMethod.length === 0
        ) {
            throw toDidResolutionError(
                new VCLError({
                    message: missingMaterialMessage,
                }),
                {
                    requestKind: ErrorTaxonomy.RequestKindPresentation,
                    requestDid: presentationRequest.iss,
                },
            );
        }
    }

    private resolvePublicJwk(
        presentationRequest: VCLPresentationRequest,
        didDocument: VCLDidDocument,
    ): VCLPublicJwk {
        try {
            const { kid } = presentationRequest.jwt;
            const publicJwk = didDocument.getPublicJwk(kid);
            if (publicJwk == null) {
                throw new VCLError({
                    message: `public jwk not found for kid: ${kid}`,
                });
            }
            return publicJwk;
        } catch (error) {
            throw toRequestValidationError(VCLError.fromError(error), {
                requestKind: ErrorTaxonomy.RequestKindPresentation,
                requestDid: presentationRequest.iss,
            });
        }
    }

    async verifyPresentationRequest(
        presentationRequest: VCLPresentationRequest,
        didDocument: VCLDidDocument,
    ): Promise<VCLPresentationRequest> {
        const publicJwk = this.resolvePublicJwk(
            presentationRequest,
            didDocument,
        );
        await this.jwtServiceRepository.verifyJwt(
            presentationRequest.jwt,
            publicJwk,
            presentationRequest.remoteCryptoServicesToken,
        );
        this.presentationRequestByDeepLinkVerifier.verifyPresentationRequest(
            presentationRequest,
            presentationRequest.deepLink,
            didDocument,
        );
        return presentationRequest;
    }
}
