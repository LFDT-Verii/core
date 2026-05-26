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
import VCLLog from '../../utils/VCLLog';
import {
    classifyDidResolution,
    classifyRequestValidation,
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
        try {
            const jwt = await this.jwtServiceRepository.decode(encodedJwtStr);
            const presentationRequest = new VCLPresentationRequest(
                jwt,
                verifiedProfile,
                presentationRequestDescriptor.deepLink,
                presentationRequestDescriptor.pushDelegate,
                presentationRequestDescriptor.didJwk,
                presentationRequestDescriptor.remoteCryptoServicesToken,
            );
            requestDid = presentationRequest.iss;
            let didDocument: VCLDidDocument;
            try {
                didDocument =
                    await this.resolveDidDocumentRepository.resolveDidDocument(
                        presentationRequest.iss,
                    );
            } catch (error) {
                throw classifyDidResolution(
                    VCLError.fromError(error),
                    ErrorTaxonomy.RequestKindPresentation,
                    requestDid,
                );
            }
            this.validateDidDocumentVerificationMaterial(
                presentationRequest,
                didDocument,
                `public jwk not found for kid: ${presentationRequest.jwt.kid}`,
            );
            return await this.verifyPresentationRequest(
                presentationRequest,
                didDocument,
            );
        } catch (error) {
            throw classifyRequestValidation(
                VCLError.fromError(error),
                ErrorTaxonomy.RequestKindPresentation,
                requestDid,
            );
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
            throw classifyDidResolution(
                new VCLError({
                    message: missingMaterialMessage,
                }),
                ErrorTaxonomy.RequestKindPresentation,
                presentationRequest.iss,
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
            throw classifyRequestValidation(
                VCLError.fromError(error),
                ErrorTaxonomy.RequestKindPresentation,
                presentationRequest.iss,
            );
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
        const isVerified =
            await this.presentationRequestByDeepLinkVerifier.verifyPresentationRequest(
                presentationRequest,
                presentationRequest.deepLink,
                didDocument,
            );
        VCLLog.info(
            `Presentation request by deep link verification result: ${isVerified}`,
        );
        return this.onVerificationSuccess(isVerified, presentationRequest);
    }

    async onVerificationSuccess(
        isVerified: boolean,
        presentationRequest: VCLPresentationRequest,
    ): Promise<VCLPresentationRequest> {
        if (isVerified) {
            return presentationRequest;
        }
        throw new VCLError({
            message: `Failed to verify: ${presentationRequest.jwt.payload}`,
        });
    }
}
