import VCLGenerateOffersDescriptor from '../../../api/entities/VCLGenerateOffersDescriptor';
import VCLOffers from '../../../api/entities/VCLOffers';
import VCLToken from '../../../api/entities/VCLToken';

export default interface GenerateOffersRepository {
    generateOffers(
        generateOffersDescriptor: VCLGenerateOffersDescriptor,
        sessionToken: VCLToken
    ): Promise<VCLOffers>;
}
