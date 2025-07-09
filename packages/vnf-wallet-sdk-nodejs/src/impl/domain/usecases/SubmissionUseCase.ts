import VCLSubmission from '../../../api/entities/VCLSubmission';
import VCLSubmissionResult from '../../../api/entities/VCLSubmissionResult';
import { Nullish } from '../../../api/VCLTypes';
import VCLAuthToken from '../../../api/entities/VCLAuthToken';

export default interface SubmissionUseCase {
    submit(
        submission: VCLSubmission,
        authToken?: Nullish<VCLAuthToken>
    ): Promise<VCLSubmissionResult>;
}
