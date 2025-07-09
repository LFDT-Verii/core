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

const jwtAccessTokenExpectation = (tenant, header, payload) => ({
  header: { alg: 'ES256K', typ: 'JWT', kid: '#exchanges-1', ...header },
  payload: {
    aud: tenant.did,
    iss: tenant.did,
    exp: expect.any(Number),
    iat: expect.any(Number),
    nbf: expect.any(Number),
    jti: expect.any(String),
    sub: expect.any(String),
    ...payload,
  },
});

module.exports = { jwtAccessTokenExpectation };
