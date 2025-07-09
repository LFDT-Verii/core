/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dictionary } from '../Types';
import Urls from '../network/Urls';
import fetcher from '../network/Fetcher';

export const getAuthToken = async (
  authTokenDescriptor: Dictionary<any>
): Promise<Dictionary<any>> => {
  const config = {
    url: Urls.getAuthToken,
    method: 'POST',
    data: { ...authTokenDescriptor },
  };
  return fetcher(config);
};
