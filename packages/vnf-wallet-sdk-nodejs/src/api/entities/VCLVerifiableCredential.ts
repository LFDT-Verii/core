import { Dictionary } from '../VCLTypes';

export default class VCLVerifiableCredential {
    constructor(
        public readonly inputDescriptor: string,
        public readonly jwtVc: string
    ) {}

    public static fromJSON(json: Dictionary<any>): VCLVerifiableCredential {
        return new VCLVerifiableCredential(json.inputDescriptor, json.jwtVc);
    }
}
