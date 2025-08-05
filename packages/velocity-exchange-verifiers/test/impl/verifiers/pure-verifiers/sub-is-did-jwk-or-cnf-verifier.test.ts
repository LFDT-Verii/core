/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { subIsDidJwkOrCnfVerifier } from 'impl/verifiers/pure-verifiers';
import {
  W3CCredentialJwtV1,
  VerificationContext,
  ERROR_CODES,
} from 'api/types';

describe('subIsDidJwkOrCnfVerifier', () => {
  const baseContext: VerificationContext = {
    path: [],
    credential_issuer_metadata: {
      iss: 'did:issuer:example',
      credential_issuer: 'https://issuer.example.com',
    },
  };

  const makeCredential = (sub?: string, cnf?: unknown): W3CCredentialJwtV1 => ({
    header: { alg: 'ES256' },
    payload: {
      iss: 'did:example',
      sub,
      cnf,
      vc: {},
    },
  });

  it('should pass if sub is "did:jwk"', () => {
    const credential = makeCredential('did:jwk');
    const result = subIsDidJwkOrCnfVerifier(credential, baseContext);
    expect(result).toEqual(null);
  });

  it('should pass if cnf is defined and sub is something else', () => {
    const credential = makeCredential('some-other-sub', { jwk: {} });
    const result = subIsDidJwkOrCnfVerifier(credential, baseContext);
    expect(result).toEqual(null);
  });

  it('should fail if sub is not "did:jwk" and cnf is missing', () => {
    const credential = makeCredential('some-other-sub');
    const result = subIsDidJwkOrCnfVerifier(credential, baseContext);
    expect(result).toMatchObject({
      code: ERROR_CODES.SUB_OR_CNF_MISSING,
      message: expect.stringContaining('some-other-sub'),
      path: ['payload'],
    });
  });

  it('should fail if sub and cnf are both missing', () => {
    const credential = makeCredential(undefined, undefined);
    const result = subIsDidJwkOrCnfVerifier(credential, baseContext);
    expect(result).toMatchObject({
      code: ERROR_CODES.SUB_OR_CNF_MISSING,
      message: expect.stringContaining('undefined'),
      path: ['payload'],
    });
  });
});
