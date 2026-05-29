import VCLCredentialManifest from '../../../api/entities/VCLCredentialManifest';
import VCLCredentialManifestDescriptor from '../../../api/entities/VCLCredentialManifestDescriptor';
import VCLError from '../../../api/entities/error/VCLError';
import { Nullish } from '../../../api/VCLTypes';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import CredentialManifestRepository from '../../domain/repositories/CredentialManifestRepository';
import { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';
import {
    toClientRequestFetchError,
    ErrorTaxonomy,
} from '../../utils/ErrorTaxonomy';

export default class CredentialManifestRepositoryImpl implements CredentialManifestRepository {
    constructor(private readonly networkService: NetworkService) {}

    async getCredentialManifest(
        credentialManifestDescriptor: VCLCredentialManifestDescriptor,
    ): Promise<Nullish<string>> {
        const { endpoint } = credentialManifestDescriptor;
        let credentialManifestResponse;
        try {
            credentialManifestResponse = await this.networkService.sendRequest({
                endpoint: endpoint!,
                method: HttpMethod.GET,
                body: null,
                headers: {
                    [HeaderKeys.XVnfProtocolVersion]:
                        HeaderValues.XVnfProtocolVersion,
                },
            });
        } catch (error) {
            throw toClientRequestFetchError(VCLError.fromError(error), {
                requestUri: endpoint,
                requestKind: ErrorTaxonomy.RequestKindIssuing,
            });
        }
        return credentialManifestResponse.payload?.[
            VCLCredentialManifest.KeyIssuingRequest
        ];
    }
}
