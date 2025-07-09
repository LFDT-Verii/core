import VCLVerifiedProfile from '../../../api/entities/VCLVerifiedProfile';
import VCLVerifiedProfileDescriptor from '../../../api/entities/VCLVerifiedProfileDescriptor';

export default interface VerifiedProfileRepository {
    getVerifiedProfile(
        verifiedProfileDescriptor: VCLVerifiedProfileDescriptor
    ): Promise<VCLVerifiedProfile>;
}
