import { Nullish, VCLJwtSignService } from '../../../../src';
import VCLJwtDescriptor from '../../../../src/api/entities/VCLJwtDescriptor';
import VCLDidJwk from '../../../../src/api/entities/VCLDidJwk';
import VCLJwt from '../../../../src/api/entities/VCLJwt';
import VCLToken from '../../../../src/api/entities/VCLToken';

export class JwtSignServiceMock implements VCLJwtSignService {
    constructor(readonly successValue: Nullish<string> = null) {}

    async sign(
        _jwtDescriptor: VCLJwtDescriptor,
        _didJwk: VCLDidJwk,
        _nonce: Nullish<string>,
        _remoteCryptoServicesToken: Nullish<VCLToken>,
    ): Promise<VCLJwt> {
        return VCLJwt.fromEncodedJwt(this.successValue ?? '');
    }
}
