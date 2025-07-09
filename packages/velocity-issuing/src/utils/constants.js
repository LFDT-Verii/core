/*
 * Copyright 2024 Velocity Team
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

const OfferType = {
  PREPREPARED_ONLY: 'PREPREPARED_ONLY',
  ALL: 'ALL',
  LEGACY: 'LEGACY',
};

const ISSUING_CHALLENGE_SIZE = 16;

const VELOCITY_NETWORK_CREDENTIAL_TYPE = {
  LAYER_1: 'VelocityNetworkLayer1Credential',
  LAYER_2: 'VelocityNetworkLayer2Credential',
};

module.exports = {
  OfferType,
  ISSUING_CHALLENGE_SIZE,
  VELOCITY_NETWORK_CREDENTIAL_TYPE,
};
