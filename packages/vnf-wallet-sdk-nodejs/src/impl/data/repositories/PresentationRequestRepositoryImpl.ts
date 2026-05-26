import VCLError from '../../../api/entities/error/VCLError';
import VCLPresentationRequest from '../../../api/entities/VCLPresentationRequest';
import VCLPresentationRequestDescriptor from '../../../api/entities/VCLPresentationRequestDescriptor';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import PresentationRequestRepository from '../../domain/repositories/PresentationRequestRepository';
import { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';
import {
    classifyClientRequestFetch,
    ErrorTaxonomy,
} from '../../utils/ErrorTaxonomy';

export default class PresentationRequestRepositoryImpl implements PresentationRequestRepository {
    constructor(private readonly networkService: NetworkService) {}

    async getPresentationRequest(
        presentationRequestDescriptor: VCLPresentationRequestDescriptor,
    ): Promise<string> {
        const { endpoint } = presentationRequestDescriptor;
        if (!endpoint) {
            throw new VCLError({
                message: 'presentationRequestDescriptor.endpoint = null',
            });
        }

        let presentationRequestResponse;
        try {
            presentationRequestResponse = await this.networkService.sendRequest(
                {
                    endpoint,
                    method: HttpMethod.GET,
                    headers: {
                        [HeaderKeys.XVnfProtocolVersion]:
                            HeaderValues.XVnfProtocolVersion,
                    },
                },
            );
        } catch (error) {
            throw classifyClientRequestFetch(
                VCLError.fromError(error),
                endpoint,
                ErrorTaxonomy.RequestKindPresentation,
            );
        }
        const presentationRequest =
            presentationRequestResponse.payload[
                VCLPresentationRequest.KeyPresentationRequest
            ];
        if (!presentationRequest) {
            throw classifyClientRequestFetch(
                new VCLError({ message: 'Missing presentation_request' }),
                endpoint,
                ErrorTaxonomy.RequestKindPresentation,
            );
        }
        return presentationRequest;
    }
}
