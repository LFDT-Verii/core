/**
 * Created by Michael Avoyan on 31/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import { expect } from 'expect';
import VCLAuthTokenDescriptor, {
    GrantType,
} from '../../src/api/entities/VCLAuthTokenDescriptor';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';

const authTokenUri =
    // eslint-disable-next-line max-len
    'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:web:devregistrar.velocitynetwork.foundation:d:example-21.com-8b82ce9a/oauth/token';
const walletDid =
    // eslint-disable-next-line max-len
    'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6InI5ZnlhNTJJbG1UbzN5YlMwd19HZWZlUV9SWDJFSF9ISm1TV3FZWU8ySlkiLCJ5IjoicFFUUmE3R2txYzVrajZvZGVNcXBnVjVUNExqYlphNEY1S1R1MkpEclduYyJ9';
const relyingPartyDid =
    'did:web:devregistrar.velocitynetwork.foundation:d:example-21.com-8b82ce9a';
const authorizationCode = 'authorization code';
const refreshToken = 'refresh-token-789';

describe('VCLAuthTokenDescriptor', () => {
    describe('VCLAuthTokenDescriptor Constructors', () => {
        it('should correctly assign properties when constructed with a VCLPresentationRequest and optional parameters', () => {
            const descriptor = new VCLAuthTokenDescriptor(
                PresentationRequestMocks.PresentationRequestFeed,
                refreshToken
            );

            expect((descriptor as any).authTokenUri).toEqual(authTokenUri);
            expect((descriptor as any).walletDid).toEqual(walletDid);
            expect((descriptor as any).relyingPartyDid).toEqual(
                relyingPartyDid
            );
            expect((descriptor as any).vendorOriginContext).toBeUndefined();
            expect((descriptor as any).refreshToken).toEqual(refreshToken);
        });

        it('should correctly assign properties when constructed with a VCLPresentationRequest without optional parameters', () => {
            const descriptor = new VCLAuthTokenDescriptor(
                PresentationRequestMocks.PresentationRequestFeed
            );

            expect((descriptor as any).authTokenUri).toEqual(authTokenUri);
            expect((descriptor as any).walletDid).toEqual(walletDid);
            expect((descriptor as any).relyingPartyDid).toEqual(
                relyingPartyDid
            );
            expect((descriptor as any).vendorOriginContext).toBeUndefined();
            expect((descriptor as any).refreshToken).toBeUndefined();
        });

        // eslint-disable-next-line max-len
        it('should correctly assign properties when constructed with authTokenUri, walletDid, relyingPartyDid, authorizationCode, and refreshToken', () => {
            const descriptor = new VCLAuthTokenDescriptor(
                authTokenUri,
                refreshToken,
                walletDid,
                relyingPartyDid,
                authorizationCode
            );

            expect((descriptor as any).authTokenUri).toEqual(authTokenUri);
            expect((descriptor as any).walletDid).toEqual(walletDid);
            expect((descriptor as any).relyingPartyDid).toEqual(
                relyingPartyDid
            );
            expect((descriptor as any).authorizationCode).toEqual(
                authorizationCode
            );
            expect((descriptor as any).refreshToken).toEqual(refreshToken);
        });
    });

    describe('generateRequestBody', () => {
        it('should generate request body for refreshToken flow when refreshToken only is provided', () => {
            const descriptor = new VCLAuthTokenDescriptor(
                authTokenUri,
                refreshToken,
                walletDid,
                relyingPartyDid,
                null
            );
            const expectedResult = {
                [VCLAuthTokenDescriptor.KeyGrantType]:
                    GrantType.RefreshToken.toString(),
                [VCLAuthTokenDescriptor.KeyClientId]: walletDid,
                [GrantType.RefreshToken]: refreshToken,
                [VCLAuthTokenDescriptor.KeyAudience]: relyingPartyDid,
            };

            const result = descriptor.generateRequestBody();

            expect(result).toEqual(expectedResult);
        });

        it('should generate request body for authorizationCode flow when authorizationCode only is provided', () => {
            const descriptor = new VCLAuthTokenDescriptor(
                authTokenUri,
                null,
                walletDid,
                relyingPartyDid,
                authorizationCode
            );
            const expectedResult = {
                [VCLAuthTokenDescriptor.KeyGrantType]:
                    GrantType.AuthorizationCode.toString(),
                [VCLAuthTokenDescriptor.KeyClientId]: walletDid,
                [GrantType.AuthorizationCode.toString()]: authorizationCode,
                [VCLAuthTokenDescriptor.KeyAudience]: relyingPartyDid,
                [VCLAuthTokenDescriptor.KeyTokenType]:
                    VCLAuthTokenDescriptor.KeyTokenTypeValue,
            };

            const result = descriptor.generateRequestBody();

            expect(result).toEqual(expectedResult);
        });

        it('should generate request body for refreshToken flow when both authorizationCode and refreshToken are provided', () => {
            const descriptor = new VCLAuthTokenDescriptor(
                authTokenUri,
                refreshToken,
                walletDid,
                relyingPartyDid,
                authorizationCode
            );
            const expectedResult = {
                [VCLAuthTokenDescriptor.KeyGrantType]:
                    GrantType.RefreshToken.toString(),
                [VCLAuthTokenDescriptor.KeyClientId]: walletDid,
                [GrantType.RefreshToken]: refreshToken,
                [VCLAuthTokenDescriptor.KeyAudience]: relyingPartyDid,
            };

            const result = descriptor.generateRequestBody();

            expect(result).toEqual(expectedResult);
        });
    });
});
