/*
 * Copyright 2025 Velocity Team
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
 *
 */

const { getOr, includes } = require('lodash/fp');

// How the registrar's emails name each Velocity network. Any other NETWORK shows as it is.
const networkNames = {
  devnet: 'DevNet',
  testnet: 'TestNet',
  mainnet: 'MainNet',
};

// Emails from these networks start their subject with the network's name
const prefixedNetworks = ['devnet', 'testnet'];

const whichNet = ({ network }) => getOr(network, network, networkNames);

const getSubjectNetPrefix = (config) =>
  includes(config.network, prefixedNetworks) ? `${whichNet(config)}: ` : '';

module.exports = { whichNet, getSubjectNetPrefix };
