import VCLPresentationRequestDescriptor from '../../../api/entities/VCLPresentationRequestDescriptor';
import { Nullish } from '../../../api/VCLTypes';

export default interface PresentationRequestRepository {
    getPresentationRequest(
        presentationRequestDescriptor: VCLPresentationRequestDescriptor,
    ): Promise<Nullish<string>>;
}
