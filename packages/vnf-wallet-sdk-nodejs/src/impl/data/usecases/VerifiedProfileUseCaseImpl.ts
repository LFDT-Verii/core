import VCLVerifiedProfileDescriptor from '../../../api/entities/VCLVerifiedProfileDescriptor';
import VerifiedProfileRepository from '../../domain/repositories/VerifiedProfileRepository';
import VerifiedProfileUseCase from '../../domain/usecases/VerifiedProfileUseCase';
import VCLError from '../../../api/entities/error/VCLError';
import { SourceMalformedVerifiedProfile } from '../../utils/ErrorTaxonomy';

export default class VerifiedProfileUseCaseImpl implements VerifiedProfileUseCase {
    constructor(
        private readonly verifiedProfileRepository: VerifiedProfileRepository,
    ) {}

    async getVerifiedProfile(
        verifiedProfileDescriptor: VCLVerifiedProfileDescriptor,
    ) {
        try {
            const verifiedProfile =
                await this.verifiedProfileRepository.getVerifiedProfile(
                    verifiedProfileDescriptor,
                );
            if (
                verifiedProfile.payload != null &&
                typeof verifiedProfile.payload === 'object' &&
                !Array.isArray(verifiedProfile.payload) &&
                Object.keys(verifiedProfile.payload).length === 0
            ) {
                throw new VCLError({
                    message: 'Empty verified profile',
                    sourceErrorCode: SourceMalformedVerifiedProfile,
                });
            }
            return verifiedProfile;
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
