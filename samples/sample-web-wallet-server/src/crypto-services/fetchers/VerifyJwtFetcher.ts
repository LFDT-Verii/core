/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  VCLPublicJwk,
  VCLJwt,
  Nullish,
  Dictionary,
} from '@verii/vnf-nodejs-wallet-sdk';
import { getJwtVerifyServiceUrl } from './Urls';
import fetcher from './Fetcher';
import { GlobalConfig } from '../../GlobalConfig';

export const verifyJwtFetcher = async (
  jwt: VCLJwt,
  publicJwk: Nullish<VCLPublicJwk>,
): Promise<Dictionary<any>> => {
  const config = {
    url: getJwtVerifyServiceUrl(GlobalConfig.environment),
    method: 'POST',
    data: {
      jwt: jwt.encodedJwt,
      publicKey: publicJwk?.valueJson ?? {},
    },
  };
  return fetcher(config);
};
