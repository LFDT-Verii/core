import { Nullish } from '../../../api/VCLTypes';
import VCLError from '../../../api/entities/error/VCLError';
import VCLFinalizeOffersDescriptor from '../../../api/entities/VCLFinalizeOffersDescriptor';
import VCLToken from '../../../api/entities/VCLToken';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import FinalizeOffersRepository from '../../domain/repositories/FinalizeOffersRepository';
import { HeaderKeys, HeaderValues } from './Urls';
import VCLJwt from '../../../api/entities/VCLJwt';
import { HttpMethod } from '../infrastructure/network/HttpMethod';

export class FinalizeOffersRepositoryImpl implements FinalizeOffersRepository {
    constructor(private networkService: NetworkService) {}

    async finalizeOffers(
        finalizeOffersDescriptor: VCLFinalizeOffersDescriptor,
        sessionToken: VCLToken,
        proof: Nullish<VCLJwt> = null
    ): Promise<VCLJwt[]> {
        const finalizedOffersResponse = await this.networkService.sendRequest({
            endpoint: finalizeOffersDescriptor.finalizeOffersUri,
            body: finalizeOffersDescriptor.generateRequestBody(proof),
            headers: {
                [HeaderKeys.Authorization]: `${HeaderValues.PrefixBearer} ${sessionToken.value}`,
                [HeaderKeys.XVnfProtocolVersion]:
                    HeaderValues.XVnfProtocolVersion,
            },
            method: HttpMethod.POST,
        });

        const encodedJwtCredArr: Nullish<string[]> =
            finalizedOffersResponse.payload as Nullish<string[]>;
        if (encodedJwtCredArr) {
            return encodedJwtCredArr.map((encodedJwtCred) =>
                VCLJwt.fromEncodedJwt(encodedJwtCred)
            );
        }
        if (finalizedOffersResponse.payload instanceof Error) {
            throw VCLError.fromError(finalizedOffersResponse.payload);
        }
        throw new VCLError(
            `Failed to parse: ${finalizedOffersResponse.payload}`
        );
    }
}
