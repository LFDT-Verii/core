import VCLVerifiedProfile from '../../../api/entities/VCLVerifiedProfile';
import VCLVerifiedProfileDescriptor from '../../../api/entities/VCLVerifiedProfileDescriptor';
import VCLError from '../../../api/entities/error/VCLError';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import VerifiedProfileRepository from '../../domain/repositories/VerifiedProfileRepository';
import { SourceMalformedVerifiedProfile } from '../../utils/ErrorTaxonomy';
import Urls, { HeaderKeys, HeaderValues, Params } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';

export default class VerifiedProfileRepositoryImpl implements VerifiedProfileRepository {
    constructor(private readonly networkService: NetworkService) {}

    async getVerifiedProfile(
        verifiedProfileDescriptor: VCLVerifiedProfileDescriptor,
    ): Promise<VCLVerifiedProfile> {
        const verifiedProfileResponse = await this.networkService.sendRequest({
            method: HttpMethod.GET,
            endpoint: Urls.VerifiedProfile.replace(
                Params.Did,
                verifiedProfileDescriptor.did,
            ),
            body: null,
            headers: {
                [HeaderKeys.XVnfProtocolVersion]:
                    HeaderValues.XVnfProtocolVersion,
            },
        });
        if (
            verifiedProfileResponse.payload == null ||
            typeof verifiedProfileResponse.payload !== 'object' ||
            Array.isArray(verifiedProfileResponse.payload) ||
            Object.keys(verifiedProfileResponse.payload).length === 0
        ) {
            throw new VCLError({
                message: 'Malformed verified profile',
                sourceErrorCode: SourceMalformedVerifiedProfile,
            });
        }
        return new VCLVerifiedProfile(verifiedProfileResponse.payload);
    }
}
