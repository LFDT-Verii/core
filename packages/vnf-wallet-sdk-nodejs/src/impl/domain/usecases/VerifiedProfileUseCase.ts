import VCLVerifiedProfile from '../../../api/entities/VCLVerifiedProfile';
import VCLVerifiedProfileDescriptor from '../../../api/entities/VCLVerifiedProfileDescriptor';

export default interface VerifiedProfileUseCase {
    getVerifiedProfile(
        verifiedProfileDescriptor: VCLVerifiedProfileDescriptor
    ): Promise<VCLVerifiedProfile>;
}
