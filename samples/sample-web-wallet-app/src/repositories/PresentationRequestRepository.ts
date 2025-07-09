/**
 * Created by Michael Avoyan on 09/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import fetcher from '../network/Fetcher';
import Urls from '../network/Urls';
import { Dictionary } from '../Types';

export const getPresentationRequest = async (
  deepLink: Dictionary<any>,
  didJwk: Dictionary<any>
): Promise<Dictionary<any>> => {
  const config = {
    url: Urls.getPresentationRequest,
    method: 'POST',
    data: { deepLink, didJwk },
  };
  return fetcher(config);
};
