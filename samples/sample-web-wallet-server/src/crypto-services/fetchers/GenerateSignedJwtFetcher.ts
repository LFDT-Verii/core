/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Dictionary,
  Nullish,
  VCLDidJwk,
  VCLJwtDescriptor,
} from '@verii/vnf-nodejs-wallet-sdk';
import { getJwtSignServiceUrl } from './Urls';
import fetcher from './Fetcher';
import { GlobalConfig } from '../../GlobalConfig';

export const generateSignedJwtFetcher = async (
  jwtDescriptor: VCLJwtDescriptor,
  didJwk: VCLDidJwk,
  nonce: Nullish<string>
): Promise<Dictionary<any>> => {
  const config = {
    url: getJwtSignServiceUrl(GlobalConfig.environment),
    method: 'POST',
    data: generateJwtPayloadToSign(jwtDescriptor, nonce, didJwk),
  };
  return fetcher(config);
};

const generateJwtPayloadToSign = (
  jwtDescriptor: VCLJwtDescriptor,
  nonce: Nullish<string>,
  didJwk: VCLDidJwk
): Dictionary<any> => {
  const payload: Dictionary<any> = jwtDescriptor.payload
    ? { ...jwtDescriptor.payload }
    : {};
  return {
    header: {
      jwk: didJwk.publicJwk.valueJson,
      kid: didJwk.kid,
    },
    payload: {
      ...payload,
      nonce,
      aud: jwtDescriptor.aud,
      jti: jwtDescriptor.jti,
      iss: jwtDescriptor.iss,
    },
    options: {
      keyId: didJwk.keyId,
    },
  };
};
