/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  VCLDidJwk,
  VCLDidJwkDescriptor,
  VCLKeyService,
} from '@verii/vnf-nodejs-wallet-sdk';
import { generateDidJwkFetcher } from './fetchers';

export class KeyServiceImpl implements VCLKeyService {
  async generateDidJwk(
    didJwkDescriptor: VCLDidJwkDescriptor,
  ): Promise<VCLDidJwk> {
    return VCLDidJwk.fromJSON(await generateDidJwkFetcher(didJwkDescriptor));
  }
}
