import VCLError from '../../../api/entities/error/VCLError';
import VCLPresentationRequest from '../../../api/entities/VCLPresentationRequest';
import VCLPresentationRequestDescriptor from '../../../api/entities/VCLPresentationRequestDescriptor';
import { Nullish } from '../../../api/VCLTypes';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import PresentationRequestRepository from '../../domain/repositories/PresentationRequestRepository';
import { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';
import {
    toClientRequestFetchError,
    ErrorTaxonomy,
} from '../../utils/ErrorTaxonomy';

export default class PresentationRequestRepositoryImpl implements PresentationRequestRepository {
    constructor(private readonly networkService: NetworkService) {}

    async getPresentationRequest(
        presentationRequestDescriptor: VCLPresentationRequestDescriptor,
    ): Promise<Nullish<string>> {
        const { endpoint } = presentationRequestDescriptor;
        let presentationRequestResponse;
        try {
            presentationRequestResponse = await this.networkService.sendRequest(
                {
                    endpoint: endpoint!,
                    method: HttpMethod.GET,
                    headers: {
                        [HeaderKeys.XVnfProtocolVersion]:
                            HeaderValues.XVnfProtocolVersion,
                    },
                },
            );
        } catch (error) {
            throw toClientRequestFetchError(VCLError.fromError(error), {
                requestUri: endpoint,
                requestKind: ErrorTaxonomy.RequestKindPresentation,
            });
        }
        return presentationRequestResponse.payload?.[
            VCLPresentationRequest.KeyPresentationRequest
        ];
    }
}
