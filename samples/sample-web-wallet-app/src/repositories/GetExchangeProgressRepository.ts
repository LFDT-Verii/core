/**
 * Created by Michael Avoyan on 14/04/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Dictionary } from '../Types';
import fetcher from '../network/Fetcher';
import Urls from '../network/Urls';

export const getExchangeProgress = async (
  presentationSubmission: Dictionary<any>,
  submissionResult: Dictionary<any>
): Promise<any> => {
  const config = {
    url: Urls.getExchangeProgress,
    method: 'POST',
    data: { presentationSubmission, submissionResult },
  };
  return fetcher(config);
};
