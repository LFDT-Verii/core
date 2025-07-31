/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { kidClaimIsVelocityV2Verifier } from 'impl/verifiers/pure-verifiers';
import {
  W3CCredentialJwtV1,
  VerificationContext,
  ERROR_CODES,
} from 'api/types';

describe('kidClaimIsVelocityV2Verifier', () => {
  const baseContext: VerificationContext = {
    path: [],
    credential_issuer_metadata: {
      iss: 'did:issuer:example',
      credential_issuer: 'https://issuer.example.com',
    },
  };

  const makeCredential = (kid?: string): W3CCredentialJwtV1 => ({
    header: { alg: 'ES256', kid },
    payload: {
      iss: 'did:example',
      vc: {},
    },
  });

  it('should pass when kid starts with "did:velocity:v2"', () => {
    const credential = makeCredential('did:velocity:v2:1234');
    const result = kidClaimIsVelocityV2Verifier(credential, baseContext);
    expect(result).toEqual(null);
  });

  it.each([
    'did:velocity:v1:1234',
    'did:web:velocity.com',
    'something-else',
    '',
  ])('should fail when kid is "%s"', (invalidKid) => {
    const credential = makeCredential(invalidKid);
    const result = kidClaimIsVelocityV2Verifier(credential, baseContext);
    expect(result).toMatchObject({
      code: ERROR_CODES.INVALID_KID,
      message: expect.stringContaining(invalidKid),
      path: ['header', 'kid'],
    });
  });

  it('should fail when kid is undefined', () => {
    const credential = makeCredential(undefined);
    const result = kidClaimIsVelocityV2Verifier(credential, baseContext);
    expect(result).toMatchObject({
      code: ERROR_CODES.INVALID_KID,
      message: expect.stringContaining('undefined'),
      path: ['header', 'kid'],
    });
  });
});
