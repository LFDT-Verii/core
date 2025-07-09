import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';
import VCLJwtVerifiableCredentials from '../../../api/entities/VCLJwtVerifiableCredentials';
import VCLToken from '../../../api/entities/VCLToken';

export default interface FinalizeOffersUseCase {
    finalizeOffers(
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor,
        sessionToken: VCLToken
    ): Promise<VCLJwtVerifiableCredentials>;
}
