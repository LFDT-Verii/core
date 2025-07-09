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

export default class PresentationRequestUseCaseImpl
    implements PresentationRequestUseCase
{
    constructor(
        private presentationRequestRepository: PresentationRequestRepository,
        private resolveDidDocumentRepository: ResolveDidDocumentRepository,
        private jwtServiceRepository: JwtServiceRepository,
        private presentationRequestByDeepLinkVerifier: PresentationRequestByDeepLinkVerifier
    ) {}

    async getPresentationRequest(
        presentationRequestDescriptor: VCLPresentationRequestDescriptor,
        verifiedProfile: VCLVerifiedProfile
    ): Promise<VCLPresentationRequest> {
        const encodedJwtStr =
            await this.presentationRequestRepository.getPresentationRequest(
                presentationRequestDescriptor
            );
        const jwt = await this.jwtServiceRepository.decode(encodedJwtStr);
        const presentationRequest = new VCLPresentationRequest(
            jwt,
            verifiedProfile,
            presentationRequestDescriptor.deepLink,
            presentationRequestDescriptor.pushDelegate,
            presentationRequestDescriptor.didJwk,
            presentationRequestDescriptor.remoteCryptoServicesToken
        );
        const didDocument =
            await this.resolveDidDocumentRepository.resolveDidDocument(
                presentationRequest.iss
            );
        const { kid } = presentationRequest.jwt;
        const publicJwk = didDocument.getPublicJwk(kid);
        if (publicJwk == null) {
            throw new VCLError(
                `Public JWK not found for kid: ${kid} in DID Document: ${didDocument}`
            );
        }
        return this.verifyPresentationRequest(
            publicJwk,
            presentationRequest,
            didDocument
        );
    }

    async verifyPresentationRequest(
        publicJwk: VCLPublicJwk,
        presentationRequest: VCLPresentationRequest,
        didDocument: VCLDidDocument
    ): Promise<VCLPresentationRequest> {
        await this.jwtServiceRepository.verifyJwt(
            presentationRequest.jwt,
            publicJwk,
            presentationRequest.remoteCryptoServicesToken
        );
        const isVerified =
            await this.presentationRequestByDeepLinkVerifier.verifyPresentationRequest(
                presentationRequest,
                presentationRequest.deepLink,
                didDocument
            );
        VCLLog.info(
            `Presentation request by deep link verification result: ${isVerified}`
        );
        return this.onVerificationSuccess(isVerified, presentationRequest);
    }

    async onVerificationSuccess(
        isVerified: boolean,
        presentationRequest: VCLPresentationRequest
    ): Promise<VCLPresentationRequest> {
        if (isVerified) {
            return presentationRequest;
        }
        throw new VCLError(
            `Failed  to verify: ${presentationRequest.jwt.payload}`
        );
    }
}
