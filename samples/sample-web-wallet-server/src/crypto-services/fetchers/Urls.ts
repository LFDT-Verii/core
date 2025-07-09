/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { VCLEnvironment } from '@verii/vnf-nodejs-wallet-sdk';

const BaseUrl = 'mockvendor.velocitycareerlabs.io';

const getServiceBaseUrl = (environment: VCLEnvironment): string => {
  switch (environment) {
    case VCLEnvironment.Dev:
      return `https://${VCLEnvironment.Dev}${BaseUrl}`;
    case VCLEnvironment.Qa:
      return `https://${VCLEnvironment.Qa}${BaseUrl}`;
    case VCLEnvironment.Staging:
      return `https://${VCLEnvironment.Staging}${BaseUrl}`;
    default:
      return `https://${BaseUrl}`;
  }
};

export const getJwtSignServiceUrl = (environment: VCLEnvironment): string =>
  `${getServiceBaseUrl(environment)}/api/jwt/sign`;

export const getJwtVerifyServiceUrl = (environment: VCLEnvironment): string =>
  `${getServiceBaseUrl(environment)}/api/jwt/verify`;

export const getCreateDidKeyServiceUrl = (
  environment: VCLEnvironment
): string => `${getServiceBaseUrl(environment)}/api/create_did_key`;
