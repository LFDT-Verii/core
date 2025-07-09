import VCLExchange from './VCLExchange';
import VCLToken from './VCLToken';

export default class VCLSubmissionResult {
    constructor(
        public readonly sessionToken: VCLToken,
        public readonly exchange: VCLExchange,
        public readonly jti: string,
        public readonly submissionId: string
    ) {}

    static readonly KeyToken = 'token';

    static readonly KeyExchange = 'exchange';

    static readonly KeyJti = 'jti';

    static readonly KeySubmissionId = 'submissionId';
}
