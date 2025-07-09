/**
 * Created by Michael Avoyan on 11/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Dictionary } from '../Types';
import Urls from '../network/Urls';
import fetcher from '../network/Fetcher';

export const generateSignedJwt = async (
  jwtDescriptor: Dictionary<any>,
  didJwk: Dictionary<any>
): Promise<any> => {
  const config = {
    url: Urls.generateSignedJwt,
    method: 'POST',
    data: { jwtDescriptor, didJwk },
  };
  return fetcher(config);
};
