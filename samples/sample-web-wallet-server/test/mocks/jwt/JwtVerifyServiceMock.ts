/* eslint-disable */
import {
  Nullish,
  VCLJwt,
  VCLJwtVerifyService,
  VCLPublicJwk,
} from '@verii/vnf-nodejs-wallet-sdk';

export class JwtVerifyServiceMock implements VCLJwtVerifyService {
  async verify(
    jwt: VCLJwt,
    publicJwk: Nullish<VCLPublicJwk>
  ): Promise<boolean> {
    return true;
  }
}
