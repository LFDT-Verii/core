import VCLPublicJwk from '../../../api/entities/VCLPublicJwk';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import ResolveKidRepository from '../../domain/repositories/ResolveKidRepository';
import Urls, { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';

export default class ResolveKidRepositoryImpl implements ResolveKidRepository {
    constructor(private readonly networkService: NetworkService) {}

    async getPublicKey(kid: string): Promise<VCLPublicJwk> {
        const publicKeyResponse = await this.networkService.sendRequest({
            endpoint: `${Urls.ResolveKid + kid}?format=${
                VCLPublicJwk.Format.jwk
            }`,
            method: HttpMethod.GET,
            headers: {
                [HeaderKeys.XVnfProtocolVersion]:
                    HeaderValues.XVnfProtocolVersion,
            },
        });
        return VCLPublicJwk.fromJSON(publicKeyResponse.payload);
    }
}
