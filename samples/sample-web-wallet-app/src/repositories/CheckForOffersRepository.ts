/**
 * Created by Michael Avoyan on 10/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Dictionary } from '../Types';
import Urls from '../network/Urls';
import fetcher from '../network/Fetcher';

export const checkOffers = async (
  generateOffersDescriptor: Dictionary<any>,
  sessionToken: Dictionary<any>
): Promise<Dictionary<any>> => {
  const config = {
    url: Urls.checkOffers,
    method: 'POST',
    data: { ...generateOffersDescriptor, sessionToken },
  };
  return fetcher(config);
};
