/**
 * Created by Michael Avoyan on 11/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import Urls from '../network/Urls';
import fetcher from '../network/Fetcher';
import { Dictionary } from '../Types';

export const getCredentialTypesUIFormSchema = async (
  credentialTypesUIFormSchemaDescriptor: Dictionary<any>
): Promise<any> => {
  const config = {
    url: Urls.getCredentialTypesUIFormSchema,
    method: 'POST',
    data: credentialTypesUIFormSchemaDescriptor,
  };
  return fetcher(config);
};
