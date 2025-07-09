import VCLJwt from '../../../api/entities/VCLJwt';
import VCLSubmission from '../../../api/entities/VCLSubmission';
import VCLSubmissionResult from '../../../api/entities/VCLSubmissionResult';
import { Nullish } from '../../../api/VCLTypes';
import VCLToken from '../../../api/entities/VCLToken';

export default interface SubmissionRepository {
    submit(
        submission: VCLSubmission,
        jwt: VCLJwt,
        accessToken?: Nullish<VCLToken>
    ): Promise<VCLSubmissionResult>;
}
