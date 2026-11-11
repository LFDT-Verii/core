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

const { from } = require('env-var');
const { network } = require('./config');
const { applyNetworkPreset } = require('./networks');

/**
 * An env-var reader for config that the network presets apply to. A preset variable that
 * isn't set reads as the selected network's value, so `networkEnv().get('LIB_URL').required()`
 * needs no setting on devnet, testnet or mainnet. With no preset, it reads like `process.env`.
 * @param {Object} [extraAccessors] env-var accessors to add, as in env-var's `from`
 * @returns {Object} the env-var reader
 */
const networkEnv = (extraAccessors) =>
  from(applyNetworkPreset(network, process.env), extraAccessors);

module.exports = { networkEnv };
