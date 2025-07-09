/* eslint-disable */
import { Nullish, VCLJwtSignService } from "../../../../src";
import VCLJwtDescriptor from "../../../../src/api/entities/VCLJwtDescriptor";
import VCLDidJwk from "../../../../src/api/entities/VCLDidJwk";
import VCLJwt from "../../../../src/api/entities/VCLJwt";
import VCLToken from "../../../../src/api/entities/VCLToken";

export class JwtSignServiceMock implements VCLJwtSignService {
    constructor(readonly successValue: Nullish<string> = null) {}

    async sign(
        jwtDescriptor: VCLJwtDescriptor,
        didJwk: VCLDidJwk,
        nonce: Nullish<string>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<VCLJwt> {
        return VCLJwt.fromEncodedJwt(this.successValue ?? '');
    }
}
