import VCLJwtDescriptor from '../../../api/entities/VCLJwtDescriptor';
import VCLSubmission from '../../../api/entities/VCLSubmission';
import VCLSubmissionResult from '../../../api/entities/VCLSubmissionResult';
import JwtServiceRepository from '../../domain/repositories/JwtServiceRepository';
import SubmissionRepository from '../../domain/repositories/SubmissionRepository';
import SubmissionUseCase from '../../domain/usecases/SubmissionUseCase';
import VCLError from '../../../api/entities/error/VCLError';
import VCLAuthToken from '../../../api/entities/VCLAuthToken';
import { Nullish } from '../../../api/VCLTypes';

export default class SubmissionUseCaseImpl implements SubmissionUseCase {
    constructor(
        private submissionRepository: SubmissionRepository,
        private jwtServiceRepository: JwtServiceRepository
    ) {}

    async submit(
        submission: VCLSubmission,
        authToken?: Nullish<VCLAuthToken>
    ): Promise<VCLSubmissionResult> {
        try {
            const jwt = await this.jwtServiceRepository.generateSignedJwt(
                new VCLJwtDescriptor(
                    submission.generatePayload(submission.didJwk.did),
                    submission.jti,
                    submission.didJwk.did
                ),
                submission.didJwk,
                null,
                submission.remoteCryptoServicesToken
            );
            return await this.submissionRepository.submit(
                submission,
                jwt,
                authToken?.accessToken
            );
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
