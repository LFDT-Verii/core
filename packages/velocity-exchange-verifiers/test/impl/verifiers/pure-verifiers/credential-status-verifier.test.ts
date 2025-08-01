/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { credentialStatusVerifier } from 'impl/verifiers/pure-verifiers/credential-status-verifier';
import {
  W3CCredentialJwtV1,
  VerificationContext,
  ERROR_CODES,
} from 'api/types';

describe('credentialStatusVerifier', () => {
  const baseContext: VerificationContext = {
    path: [],
    credential_issuer_metadata: {
      iss: 'did:issuer:example',
      credential_issuer: 'https://issuer.example.com',
    },
  };

  const buildCredential = (
    statusValue: unknown = { id: 'https://status.example.com' }
  ): W3CCredentialJwtV1 => ({
    header: { alg: 'ES256' },
    payload: {
      iss: 'did:example',
      vc: {
        credentialStatus: statusValue,
      },
    },
  });

  it('should pass when credentialStatus is present', () => {
    const credential = buildCredential();
    const result = credentialStatusVerifier(credential, baseContext);
    expect(result).toEqual(null);
  });

  it('should fail when credentialStatus is undefined', () => {
    const credential: W3CCredentialJwtV1 = {
      header: { alg: 'ES256' },
      payload: {
        iss: 'did:example',
        vc: {}, // missing credentialStatus
      },
    };
    const result = credentialStatusVerifier(credential, baseContext);

    expect(result).toMatchObject({
      code: ERROR_CODES.MISSING_CREDENTIAL_STATUS,
      path: ['payload', 'vc', 'credentialStatus'],
    });
  });

  it('should fail when vc is missing', () => {
    const credential: W3CCredentialJwtV1 = {
      header: { alg: 'ES256' },
      payload: {
        iss: 'did:example',
        vc: {},
      },
    };
    const result = credentialStatusVerifier(credential, baseContext);

    expect(result).toMatchObject({
      code: ERROR_CODES.MISSING_CREDENTIAL_STATUS,
      path: ['payload', 'vc', 'credentialStatus'],
    });
  });

  it('should include full path when nested in a context', () => {
    const credential = {
      header: { alg: 'ES256' },
      payload: {
        iss: 'did:example',
        vc: {},
      },
    };
    const nestedContext: VerificationContext = {
      ...baseContext,
      path: ['credentials', 0],
    };
    const result = credentialStatusVerifier(
      credential as W3CCredentialJwtV1,
      nestedContext
    );

    expect(result?.path).toEqual([
      'credentials',
      0,
      'payload',
      'vc',
      'credentialStatus',
    ]);
  });
});
