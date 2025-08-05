/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { issClaimMatchesMetadataVerifier } from 'impl/verifiers/pure-verifiers';
import {
  W3CCredentialJwtV1,
  VerificationContext,
  ERROR_CODES,
} from 'api/types';

describe('issClaimMatchesMetadataVerifier', () => {
  const baseContext: VerificationContext = {
    path: [],
    credential_issuer_metadata: {
      iss: 'did:velocity:issuer123',
      credential_issuer: 'https://issuer.velocitycareerlabs.com',
    },
  };

  const makeCredential = (iss: string): W3CCredentialJwtV1 => ({
    header: { alg: 'ES256' },
    payload: {
      iss,
      vc: {},
    },
  });

  it('should pass when iss matches credential_issuer_metadata.iss exactly', () => {
    const credential = makeCredential('did:velocity:issuer123');
    const result = issClaimMatchesMetadataVerifier(credential, baseContext);
    expect(result).toEqual(null);
  });

  it('should fail when iss matches credential_issuer_metadata.credential_issuer but not .iss', () => {
    const credential = makeCredential('https://issuer.velocitycareerlabs.com');
    const result = issClaimMatchesMetadataVerifier(credential, baseContext);
    expect(result).toMatchObject({
      code: ERROR_CODES.UNEXPECTED_CREDENTIAL_PAYLOAD_ISS,
      message: expect.stringContaining('https://issuer.velocitycareerlabs.com'),
      path: ['payload', 'iss'],
    });
  });

  it('should fail when iss does not match anything', () => {
    const credential = makeCredential('did:wrong:issuer');
    const result = issClaimMatchesMetadataVerifier(credential, baseContext);
    expect(result).toMatchObject({
      code: ERROR_CODES.UNEXPECTED_CREDENTIAL_PAYLOAD_ISS,
      message: expect.stringContaining('did:wrong:issuer'),
      path: ['payload', 'iss'],
    });
  });

  it('should fail when iss is missing', () => {
    const credential = makeCredential('');
    const result = issClaimMatchesMetadataVerifier(credential, baseContext);
    expect(result).toMatchObject({
      code: ERROR_CODES.UNEXPECTED_CREDENTIAL_PAYLOAD_ISS,
      message: expect.stringContaining(''),
      path: ['payload', 'iss'],
    });
  });
});
