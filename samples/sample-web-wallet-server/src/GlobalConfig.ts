/**
 * Created by Michael Avoyan on 30/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import env from 'env-var';
import {
  environmentFromString,
  VCLEnvironment,
  VCLXVnfProtocolVersion,
  vnfProtocolVersionFromString,
} from '@verii/vnf-nodejs-wallet-sdk';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: '.local.env' });

type GlobalConfigType = {
  nodeEnv: string;
  port: number;
  host: string;
  environment: VCLEnvironment;
  xVnfProtocolVersion: VCLXVnfProtocolVersion;
  isDebugOn: boolean;
};

const GlobalConfig: GlobalConfigType = {
  nodeEnv: env.get('NODE_ENV').required().asString(),
  port: env.get('PORT').required().asIntPositive(),
  host: env.get('HOST').required().asString(),
  environment: environmentFromString(
    env.get('ENVIRONMENT').required().asString()
  ),
  xVnfProtocolVersion: vnfProtocolVersionFromString(
    env.get('X_VNF_PROTOCOL').required().asString()
  ),
  isDebugOn: env.get('IS_DEBUG_ON').required().asBool(),
};

export { GlobalConfig };
