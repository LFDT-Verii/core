/**
 * Created by Michael Avoyan on 09/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Dictionary } from '../Types';
import Urls from '../network/Urls';
import fetcher from '../network/Fetcher';

export const searchForOrganizations = async (
  organizationDescriptor: Dictionary<any>
): Promise<any> => {
  const config = {
    url: Urls.searchForOrganizations,
    method: 'POST',
    data: organizationDescriptor,
  };
  return fetcher(config);
};
