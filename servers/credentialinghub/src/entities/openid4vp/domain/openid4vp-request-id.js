/*
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
 *
 */

const newError = require('http-errors');

const OPENID4VP_SERVICE_REQUEST_PREFIX = 's-';
const OPENID4VP_DEPOT_REQUEST_PREFIX = 'd-';

const parseOpenid4vpRequestId = (requestId) => {
  if (requestId?.startsWith(OPENID4VP_SERVICE_REQUEST_PREFIX)) {
    return {
      type: 'service',
      id: requestId.substring(OPENID4VP_SERVICE_REQUEST_PREFIX.length),
    };
  }

  if (requestId?.startsWith(OPENID4VP_DEPOT_REQUEST_PREFIX)) {
    return {
      type: 'depot',
      id: requestId.substring(OPENID4VP_DEPOT_REQUEST_PREFIX.length),
    };
  }

  throw newError(400, 'openid4vp_request_id_invalid', {
    errorCode: 'openid4vp_request_id_invalid',
  });
};

module.exports = {
  OPENID4VP_DEPOT_REQUEST_PREFIX,
  OPENID4VP_SERVICE_REQUEST_PREFIX,
  parseOpenid4vpRequestId,
};
