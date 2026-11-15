/**
 * Copyright 2026 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { isNil } = require('lodash/fp');

// The lines a server's healthcheck (GET /) adds about its deployment, so anyone can see which
// network it runs on: the environment label and, for a server with blockchain config, the chain ID
const describeDeployment = ({ environmentLabel, chainId }) =>
  isNil(chainId)
    ? `Environment: ${environmentLabel}\n`
    : `Environment: ${environmentLabel}\nChain ID: ${chainId}\n`;

module.exports = { describeDeployment };
