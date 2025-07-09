import VCLPresentationSubmission from './VCLPresentationSubmission';
import VCLSubmissionResult from './VCLSubmissionResult';

export default class VCLExchangeDescriptor {
    constructor(
        public readonly presentationSubmission: VCLPresentationSubmission,
        public readonly submissionResult: VCLSubmissionResult
    ) {}

    get processUri() {
        return this.presentationSubmission.progressUri;
    }

    get exchangeId() {
        return this.submissionResult.exchange.id;
    }

    get sessionToken() {
        return this.submissionResult.sessionToken;
    }

    static readonly KeyExchangeId = 'exchange_id';
}
