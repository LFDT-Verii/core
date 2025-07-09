/**
 * Copyright 2023 Velocity Team
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

const { split, last, first } = require('lodash/fp');
const { jwtDecode, jwtSign, jwtVerify } = require('@verii/jwt');
const {
  KeyPurposes,
  generateKeyPair,
  createCommitment,
} = require('@verii/crypto');
const {
  generatePushGatewayToken,
} = require('../../src/fetchers/push-gateway/generate-push-gateway-token');

describe('Generate authorization token for push gateway', () => {
  const { privateKey, publicKey } = generateKeyPair({ format: 'jwk' });
  const oracleUrl = 'https://oracle.vnf';
  const pushUrl = 'https:/push.oracle.vnf/push';
  const pushUrlOrigin = new URL(pushUrl).origin;
  const traceId = '123';
  const did = 'did:velocity:123';
  const kidFragment = '#key-1';
  const exchangeId = '234';
  const body = {
    testUndefined: undefined,
    data: {
      exchangeId,
    },
  };
  const context = {
    tenant: { did, _id: '321' },
    traceId,
    tenantKeysByPurpose: { [KeyPurposes.EXCHANGES]: { kidFragment } },
    config: { oracleUrl },
    kms: {
      signJwt: (payload, keyId, headers) =>
        jwtSign(payload, privateKey, headers),
    },
  };

  it('Verify jwt token payload, header and hash of push gateway params', async () => {
    const authHeader = await generatePushGatewayToken(body, pushUrl, context);

    const token = last(split('Bearer ', authHeader));
    const decodedToken = jwtDecode(token);
    const {
      payload: { hash },
    } = decodedToken;

    expect(hash).toEqual(createCommitment(JSON.stringify(body)));
    expect(decodedToken).toEqual({
      header: {
        alg: 'ES256K',
        kid: `${did}${kidFragment}`,
        typ: 'JWT',
      },
      payload: {
        aud: pushUrlOrigin,
        hash,
        iss: did,
        jti: traceId,
        sub: exchangeId,
        iat: expect.any(Number),
        nbf: expect.any(Number),
        exp: expect.any(Number),
      },
    });
  });

  it('Verify jwt token signature and claims', async () => {
    const authHeader = await generatePushGatewayToken(body, pushUrl, context);

    const token = last(split('Bearer ', authHeader));
    const decodedToken = jwtDecode(token);
    const {
      header: { kid },
    } = decodedToken;
    await jwtVerify(token, publicKey, {
      issuer: first(split('#', kid)),
      audience: pushUrlOrigin,
      jti: traceId,
      subject: exchangeId,
    });
  });

  it('Verify jwt token fails if an invalid aud claim', async () => {
    const authHeader = await generatePushGatewayToken(body, pushUrl, context);

    const token = last(split('Bearer ', authHeader));
    const decodedToken = jwtDecode(token);
    const {
      header: { kid },
    } = decodedToken;
    await expect(() =>
      jwtVerify(token, publicKey, {
        issuer: first(split('#', kid)),
        audience: 'https:/oracle.vnf',
        jti: traceId,
        subject: exchangeId,
      })
    ).rejects.toThrow();
  });
});
