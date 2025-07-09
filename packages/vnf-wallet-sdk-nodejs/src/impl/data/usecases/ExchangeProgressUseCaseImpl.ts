import VCLExchange from '../../../api/entities/VCLExchange';
import VCLExchangeDescriptor from '../../../api/entities/VCLExchangeDescriptor';
import ExchangeProgressRepository from '../../domain/repositories/ExchangeProgressRepository';
import ExchangeProgressUseCase from '../../domain/usecases/ExchangeProgressUseCase';
import VCLError from '../../../api/entities/error/VCLError';

export default class ExchangeProgressUseCaseImpl
    implements ExchangeProgressUseCase
{
    constructor(
        private exchangeProgressRepository: ExchangeProgressRepository
    ) {}

    async getExchangeProgress(
        exchangeDescriptor: VCLExchangeDescriptor
    ): Promise<VCLExchange> {
        try {
            return await this.exchangeProgressRepository.getExchangeProgress(
                exchangeDescriptor
            );
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
