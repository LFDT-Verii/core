import { Dictionary, Nullish } from '../../../api/VCLTypes';
import VCLExchange from '../../../api/entities/VCLExchange';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLSubmission from '../../../api/entities/VCLSubmission';
import VCLSubmissionResult from '../../../api/entities/VCLSubmissionResult';
import VCLToken from '../../../api/entities/VCLToken';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import SubmissionRepository from '../../domain/repositories/SubmissionRepository';
import { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';

export default class SubmissionRepositoryImpl implements SubmissionRepository {
    constructor(private networkService: NetworkService) {}

    async submit(
        submission: VCLSubmission,
        jwt: VCLJwt,
        accessToken?: Nullish<VCLToken>
    ): Promise<VCLSubmissionResult> {
        const submissionResponse = await this.networkService.sendRequest({
            endpoint: submission.submitUri,
            body: submission.generateRequestBody(jwt),
            method: HttpMethod.POST,
            headers: this.generateHeader(accessToken),
        });
        return this.parse(
            submissionResponse.payload,
            submission.jti,
            submission.submissionId
        );
    }

    public generateHeader = (accessToken: Nullish<VCLToken> = null) => {
        const header = {
            [HeaderKeys.XVnfProtocolVersion]: HeaderValues.XVnfProtocolVersion,
        };

        if (accessToken != null) {
            header[HeaderKeys.Authorization] = `Bearer ${accessToken?.value}`;
        }

        return header;
    };

    private parseExchange(exchangeJsonObj: Dictionary<any>) {
        return new VCLExchange(
            exchangeJsonObj[VCLExchange.KeyId] ?? '',
            exchangeJsonObj[VCLExchange.KeyType] ?? '',
            exchangeJsonObj[VCLExchange.KeyDisclosureComplete] ?? false,
            exchangeJsonObj[VCLExchange.KeyExchangeComplete] ?? false
        );
    }

    private parse(
        jsonObj: Dictionary<any>,
        jti: string,
        submissionId: string
    ): VCLSubmissionResult {
        const exchangeJsonObj = jsonObj[VCLSubmissionResult.KeyExchange];
        return new VCLSubmissionResult(
            new VCLToken(jsonObj[VCLSubmissionResult.KeyToken]),
            this.parseExchange(exchangeJsonObj),
            jti,
            submissionId
        );
    }
}
