/**
 * Created by Michael Avoyan on 08/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import Urls from '../network/Urls';
import fetcher from '../network/Fetcher';
import { Dictionary } from '../Types';

export const getCountries = async (): Promise<Dictionary<any>> => {
  const config = {
    url: Urls.getCountries,
    method: 'GET',
  };
  return fetcher(config);
};
