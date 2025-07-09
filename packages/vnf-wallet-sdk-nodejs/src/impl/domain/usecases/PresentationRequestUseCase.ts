import VCLPresentationRequest from '../../../api/entities/VCLPresentationRequest';
import VCLPresentationRequestDescriptor from '../../../api/entities/VCLPresentationRequestDescriptor';
import VCLVerifiedProfile from '../../../api/entities/VCLVerifiedProfile';

export default interface PresentationRequestUseCase {
    getPresentationRequest(
        presentationRequestDescriptor: VCLPresentationRequestDescriptor,
        verifiedProfile: VCLVerifiedProfile
    ): Promise<VCLPresentationRequest>;
}
