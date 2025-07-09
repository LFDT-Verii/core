import VCLGenerateOffersDescriptor from '../../../api/entities/VCLGenerateOffersDescriptor';
import VCLOffers from '../../../api/entities/VCLOffers';
import VCLToken from '../../../api/entities/VCLToken';
import GenerateOffersRepository from '../../domain/repositories/GenerateOffersRepository';
import GenerateOffersUseCase from '../../domain/usecases/GenerateOffersUseCase';
import VCLError from '../../../api/entities/error/VCLError';
import OffersByDeepLinkVerifier from '../../domain/verifiers/OffersByDeepLinkVerifier';
import VCLLog from '../../utils/VCLLog';

export default class GenerateOffersUseCaseImpl
    implements GenerateOffersUseCase
{
    constructor(
        private generateOffersRepository: GenerateOffersRepository,
        private offersByDeepLinkVerifier: OffersByDeepLinkVerifier
    ) {}

    async generateOffers(
        generateOffersDescriptor: VCLGenerateOffersDescriptor,
        sessionToken: VCLToken
    ): Promise<VCLOffers> {
        try {
            const offers = await this.generateOffersRepository.generateOffers(
                generateOffersDescriptor,
                sessionToken
            );
            return await this.verifyOffersByDeepLink(
                offers,
                generateOffersDescriptor
            );
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }

    async verifyOffersByDeepLink(
        offers: VCLOffers,
        generateOffersDescriptor: VCLGenerateOffersDescriptor
    ): Promise<VCLOffers> {
        if (generateOffersDescriptor.credentialManifest.deepLink != null) {
            const isVerified = await this.offersByDeepLinkVerifier.verifyOffers(
                offers,
                generateOffersDescriptor.credentialManifest.deepLink
            );
            VCLLog.info(`Offers deep link verification result: ${isVerified}`);
        } else {
            VCLLog.info('Deep link was not provided => nothing to verify');
        }
        return offers;
    }
}
