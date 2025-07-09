import VCLJwt from './VCLJwt';

export default class VCLJwtVerifiableCredentials {
    constructor(
        public readonly passedCredentials: VCLJwt[],
        public readonly failedCredentials: VCLJwt[]
    ) {}
}
