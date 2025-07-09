/* eslint-disable */
import {
  Nullish,
  VCLDidJwk,
  VCLJwt,
  VCLJwtDescriptor,
  VCLJwtSignService,
  VCLToken,
} from '@verii/vnf-nodejs-wallet-sdk';

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
