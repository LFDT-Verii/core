/**
 * Created by Michael Avoyan on 10/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import Urls from '../network/Urls';
import { Dictionary } from '../Types';
import fetcher from '../network/Fetcher';

export const generateDidJwk = async (
  generateDidJwkDescriptor: Dictionary<any>
): Promise<Dictionary<any>> => {
  const config = {
    url: Urls.generateDidJwk,
    method: 'POST',
    data: generateDidJwkDescriptor,
  };
  return fetcher(config);
};
