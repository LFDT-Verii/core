/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dictionary, VCLDidJwkDescriptor } from '@verii/vnf-nodejs-wallet-sdk';
import { getCreateDidKeyServiceUrl } from './Urls';
import fetcher from './Fetcher';
import { GlobalConfig } from '../../GlobalConfig';

export const generateDidJwkFetcher = async (
  didJwkDescriptor: VCLDidJwkDescriptor
): Promise<Dictionary<any>> => {
  const config = {
    url: getCreateDidKeyServiceUrl(GlobalConfig.environment),
    method: 'POST',
    data: {
      crv: `${didJwkDescriptor.signatureAlgorithm}`,
      didMethod: 'did:jwk',
    },
  };
  return fetcher(config);
};
