import VCLPresentationRequestDescriptor from '../../../api/entities/VCLPresentationRequestDescriptor';

export default interface PresentationRequestRepository {
    getPresentationRequest(
        presentationRequestDescriptor: VCLPresentationRequestDescriptor
    ): Promise<string>;
}
