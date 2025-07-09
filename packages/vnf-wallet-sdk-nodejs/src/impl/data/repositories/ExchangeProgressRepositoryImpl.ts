import { Dictionary } from '../../../api/VCLTypes';
import VCLExchange from '../../../api/entities/VCLExchange';
import VCLExchangeDescriptor from '../../../api/entities/VCLExchangeDescriptor';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import ExchangeProgressRepository from '../../domain/repositories/ExchangeProgressRepository';
import { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';

export default class ExchangeProgressRepositoryImpl
    implements ExchangeProgressRepository
{
    constructor(private networkService: NetworkService) {}

    async getExchangeProgress(
        exchangeDescriptor: VCLExchangeDescriptor
    ): Promise<VCLExchange> {
        const exchangeProgressResponse = await this.networkService.sendRequest({
            method: HttpMethod.GET,
            endpoint: `${exchangeDescriptor.processUri}?${
                VCLExchangeDescriptor.KeyExchangeId
            }=${encodeURIComponent(exchangeDescriptor.exchangeId)}`,
            headers: {
                [HeaderKeys.Authorization]: `${HeaderValues.PrefixBearer} ${exchangeDescriptor.sessionToken.value}`,
                [HeaderKeys.XVnfProtocolVersion]:
                    HeaderValues.XVnfProtocolVersion,
            },
        });

        return this.parseExchange(exchangeProgressResponse.payload);
    }

    private parseExchange(exchangeJsonObj: Dictionary<any>) {
        return new VCLExchange(
            exchangeJsonObj[VCLExchange.KeyId],
            exchangeJsonObj[VCLExchange.KeyType],
            exchangeJsonObj[VCLExchange.KeyDisclosureComplete],
            exchangeJsonObj[VCLExchange.KeyExchangeComplete]
        );
    }
}
