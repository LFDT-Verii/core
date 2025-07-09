import {
  VCLDidJwk,
  VCLDidJwkDescriptor,
  VCLKeyService,
} from '@verii/vnf-nodejs-wallet-sdk';
import { DidJwkMocks } from '../DidJwkMocks';

export class KeyServiceMock implements VCLKeyService {
  async generateDidJwk(
    // eslint-disable-next-line no-unused-vars
    didJwkDescriptor: VCLDidJwkDescriptor
  ): Promise<VCLDidJwk> {
    return DidJwkMocks.DidJwk;
  }
}
