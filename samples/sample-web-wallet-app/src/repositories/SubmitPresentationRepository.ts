/**
 * Created by Michael Avoyan on 09/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import Urls from '../network/Urls';
import fetcher from '../network/Fetcher';
import { Dictionary } from '../Types';

export const submitPresentation = async (
  presentationSubmission: Dictionary<any>,
  authToken?: Dictionary<any>
): Promise<Dictionary<any>> => {
  const config = {
    url: Urls.submitPresentation,
    method: 'POST',
    data: { presentationSubmission, authToken },
  };
  return fetcher(config);
};
