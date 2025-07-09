import { Nullish } from '../VCLTypes';
import VCLDidJwk from '../entities/VCLDidJwk';
import VCLJwt from '../entities/VCLJwt';
import VCLJwtDescriptor from '../entities/VCLJwtDescriptor';
import VCLToken from '../entities/VCLToken';

export default interface VCLJwtSignService {
    sign(
        jwtDescriptor: VCLJwtDescriptor,
        didJwk: VCLDidJwk,
        nonce: Nullish<string>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<VCLJwt>;
}
