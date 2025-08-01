/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  W3CCredentialJwtV1,
  VerificationContext,
  ERROR_CODES,
} from 'api/types';
import { algIsSupportedVerifier } from 'impl/verifiers/pure-verifiers';

describe('algIsSupportedVerifier', () => {
  const baseContext: VerificationContext = {
    path: [],
    credential_issuer_metadata: {
      iss: 'did:issuer:example',
      credential_issuer: 'https://issuer.example.com',
    },
  };

  const makeCredential = (alg?: string): W3CCredentialJwtV1 => {
    const header = alg !== undefined ? { alg } : ({} as any);
    return {
      header,
      payload: {
        iss: 'did:example',
        vc: {},
      },
    };
  };

  it.each(['ES256', 'ES256K', 'RS256'])(
    'should pass for supported alg "%s"',
    (alg) => {
      const credential = makeCredential(alg);
      const result = algIsSupportedVerifier(credential, baseContext);
      expect(result).toEqual(null);
    }
  );

  it.each(['HS256', 'none', '', 'EdDSA'])(
    'should fail for unsupported alg "%s"',
    (alg) => {
      const credential = makeCredential(alg);
      const result = algIsSupportedVerifier(credential, baseContext);
      expect(result).toMatchObject({
        code: ERROR_CODES.INVALID_ALG,
        message: expect.stringContaining(alg),
        path: ['header', 'alg'],
      });
    }
  );

  it('should fail when alg is missing entirely', () => {
    const credential = makeCredential(undefined);
    const result = algIsSupportedVerifier(credential, baseContext);
    expect(result).toMatchObject({
      code: ERROR_CODES.INVALID_ALG,
      message: expect.stringContaining('undefined'),
      path: ['header', 'alg'],
    });
  });
});
