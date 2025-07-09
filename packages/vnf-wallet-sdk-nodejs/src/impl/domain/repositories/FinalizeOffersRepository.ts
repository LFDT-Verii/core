import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';
import VCLToken from '../../../api/entities/VCLToken';
import VCLJwt from '../../../api/entities/VCLJwt';
import { Nullish } from '../../../api/VCLTypes';

export default interface FinalizeOffersRepository {
    finalizeOffers(
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor,
        sessionToken: VCLToken,
        proof: Nullish<VCLJwt>
    ): Promise<VCLJwt[]>;
}
