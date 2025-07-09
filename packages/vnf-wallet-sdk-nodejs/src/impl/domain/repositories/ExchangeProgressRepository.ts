import VCLExchange from '../../../api/entities/VCLExchange';
import VCLExchangeDescriptor from '../../../api/entities/VCLExchangeDescriptor';

export default interface ExchangeProgressRepository {
    getExchangeProgress(
        exchangeDescriptor: VCLExchangeDescriptor
    ): Promise<VCLExchange>;
}
