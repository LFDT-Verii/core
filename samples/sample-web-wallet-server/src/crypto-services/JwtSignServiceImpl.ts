/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Nullish,
  VCLJwt,
  VCLJwtSignService,
  VCLDidJwk,
  VCLJwtDescriptor,
} from '@verii/vnf-nodejs-wallet-sdk';
import { generateSignedJwtFetcher } from './fetchers';

export class JwtSignServiceImpl implements VCLJwtSignService {
  async sign(
    jwtDescriptor: VCLJwtDescriptor,
    didJwk: VCLDidJwk,
    nonce: Nullish<string>,
  ): Promise<VCLJwt> {
    const jwtJson = await generateSignedJwtFetcher(
      jwtDescriptor,
      didJwk,
      nonce,
    );
    return VCLJwt.fromEncodedJwt(jwtJson.compactJwt as string);
  }
}
