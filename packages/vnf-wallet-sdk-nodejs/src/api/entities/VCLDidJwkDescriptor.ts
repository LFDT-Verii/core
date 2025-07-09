import { Nullish } from '../VCLTypes';
import VCLToken from './VCLToken';
import VCLSignatureAlgorithm from '../VCLSignatureAlgorithm';

export default class VCLDidJwkDescriptor {
    constructor(
        public signatureAlgorithm: VCLSignatureAlgorithm = VCLSignatureAlgorithm.ES256,
        public remoteCryptoServicesToken: Nullish<VCLToken> = null
    ) {}
}
