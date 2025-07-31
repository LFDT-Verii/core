/**
 * Created by Michael Avoyan on 17/07/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ERROR_CODES,
  VerificationContext,
  W3CCredentialJwtV1,
} from 'api/types';
import { verifyCredentialJwtPayloadStrict } from 'impl/rules';
import { verifyCredentialEndpointResponse } from 'api/verify-credential-endpoint-response';

// Mock all internal verifiers used by verifyCredentialJwtPayloadStrict
jest.mock('impl/rules', () => ({
  verifyCredentialJwtPayloadStrict: jest.fn(),
}));

describe('verifyCredentialEndpointResponse', () => {
  const baseContext: VerificationContext = {
    path: [],
    credential_issuer_metadata: {
      iss: 'did:issuer:example',
      credential_issuer: 'https://issuer.example.com',
    },
  };

  const mockCredential: W3CCredentialJwtV1 = {
    header: { alg: 'ES256' },
    payload: {
      iss: 'did:issuer:example',
      vc: {
        credentialSchema: {},
        credentialStatus: {},
      },
      kid: 'did:velocity:v2:abc123',
      sub: 'did:jwk',
    },
  };

  beforeEach(() => {
    (verifyCredentialJwtPayloadStrict as jest.Mock).mockReset();
  });

  it('returns no errors when credentials are valid', () => {
    (verifyCredentialJwtPayloadStrict as jest.Mock).mockReturnValue([]);

    const response = { credentials: [mockCredential] };
    const result = verifyCredentialEndpointResponse(response, baseContext);

    expect(result).toEqual([]);
    expect(verifyCredentialJwtPayloadStrict).toHaveBeenCalledTimes(1);
  });

  it('returns all errors when credentials are invalid', () => {
    const mockErrors = [
      {
        code: ERROR_CODES.INVALID_ALG,
        message: 'alg is not supported',
        path: ['credentials', 0, 'header', 'alg'],
      },
    ];
    (verifyCredentialJwtPayloadStrict as jest.Mock).mockReturnValue(mockErrors);

    const response = { credentials: [mockCredential] };
    const result = verifyCredentialEndpointResponse(response, baseContext);

    expect(result).toEqual(mockErrors);
  });

  it('aggregates errors from multiple credentials', () => {
    const errors1 = [
      {
        code: ERROR_CODES.INVALID_KID,
        message: 'Invalid kid',
        path: ['credentials', 0, 'payload', 'kid'],
      },
    ];
    const errors2 = [
      {
        code: ERROR_CODES.MISSING_CREDENTIAL_STATUS,
        message: 'Missing credentialStatus',
        path: ['credentials', 1, 'payload', 'vc', 'credentialStatus'],
      },
    ];

    (verifyCredentialJwtPayloadStrict as jest.Mock)
      .mockReturnValueOnce(errors1)
      .mockReturnValueOnce(errors2);

    const response = { credentials: [mockCredential, mockCredential] };
    const result = verifyCredentialEndpointResponse(response, baseContext);

    expect(result).toEqual([...errors1, ...errors2]);
    expect(verifyCredentialJwtPayloadStrict).toHaveBeenCalledTimes(2);
  });

  it('returns empty list when credentials are missing', () => {
    const response = {};
    const result = verifyCredentialEndpointResponse(response, baseContext);

    expect(result).toEqual([]);
    expect(verifyCredentialJwtPayloadStrict).not.toHaveBeenCalled();
  });

  it('returns empty list when credentials is an empty array', () => {
    const response = { credentials: [] };
    const result = verifyCredentialEndpointResponse(response, baseContext);

    expect(result).toEqual([]);
    expect(verifyCredentialJwtPayloadStrict).not.toHaveBeenCalled();
  });
});
