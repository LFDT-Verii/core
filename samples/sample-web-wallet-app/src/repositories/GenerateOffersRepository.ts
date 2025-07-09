/**
 * Created by Michael Avoyan on 09/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Dictionary } from '../Types';
import Urls from '../network/Urls';
import fetcher from '../network/Fetcher';

export const generateOffers = async (
  generateOffersDescriptor: Dictionary<any>
): Promise<Dictionary<any>> => {
  const config = {
    url: Urls.generateOffers,
    method: 'POST',
    data: generateOffersDescriptor,
  };
  return fetcher(config);
};
