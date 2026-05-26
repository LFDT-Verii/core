import VCLCredentialManifest from '../../../api/entities/VCLCredentialManifest';
import VCLCredentialManifestDescriptor from '../../../api/entities/VCLCredentialManifestDescriptor';
import VCLError from '../../../api/entities/error/VCLError';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import CredentialManifestRepository from '../../domain/repositories/CredentialManifestRepository';
import { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';
import {
    classifyClientRequestFetch,
    ErrorTaxonomy,
} from '../../utils/ErrorTaxonomy';

export default class CredentialManifestRepositoryImpl implements CredentialManifestRepository {
    constructor(private readonly networkService: NetworkService) {}

    async getCredentialManifest(
        credentialManifestDescriptor: VCLCredentialManifestDescriptor,
    ): Promise<string> {
        const { endpoint } = credentialManifestDescriptor;
        if (!endpoint) {
            throw new VCLError({
                message: 'credentialManifestDescriptor.endpoint = null',
            });
        }

        let credentialManifestResponse;
        try {
            credentialManifestResponse = await this.networkService.sendRequest({
                endpoint,
                method: HttpMethod.GET,
                body: null,
                headers: {
                    [HeaderKeys.XVnfProtocolVersion]:
                        HeaderValues.XVnfProtocolVersion,
                },
            });
        } catch (error) {
            throw classifyClientRequestFetch(
                VCLError.fromError(error),
                endpoint,
                ErrorTaxonomy.RequestKindIssuing,
            );
        }
        const issuingRequest =
            credentialManifestResponse.payload[
                VCLCredentialManifest.KeyIssuingRequest
            ];
        if (!issuingRequest) {
            throw classifyClientRequestFetch(
                new VCLError({ message: 'Missing issuing_request' }),
                endpoint,
                ErrorTaxonomy.RequestKindIssuing,
            );
        }
        return issuingRequest;
    }
}
