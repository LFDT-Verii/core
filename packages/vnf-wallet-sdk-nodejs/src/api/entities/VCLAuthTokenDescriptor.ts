/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Dictionary, Nullish } from '../VCLTypes';
import VCLPresentationRequest from './VCLPresentationRequest';

// eslint-disable-next-line no-shadow
export enum GrantType {
    AuthorizationCode = 'authorization_code',
    RefreshToken = 'refresh_token',
}

export default class VCLAuthTokenDescriptor {
    public readonly authTokenUri: string;

    public readonly refreshToken?: Nullish<string>;

    public readonly walletDid?: Nullish<string>;

    public readonly relyingPartyDid?: Nullish<string>;

    public readonly authorizationCode?: Nullish<string>; // vendorOriginContext value

    constructor(
        authTokenUri: string,
        refreshToken?: Nullish<string>,
        walletDid?: Nullish<string>,
        relyingPartyDid?: Nullish<string>,
        vendorOriginContext?: Nullish<string>
    );

    constructor(
        presentationRequest: VCLPresentationRequest,
        refreshToken?: Nullish<string>
    );

    constructor(
        authTokenUriOrPresentationRequest: string | VCLPresentationRequest,
        refreshToken?: Nullish<string>,
        walletDid?: Nullish<string>,
        relyingPartyDid?: Nullish<string>,
        vendorOriginContext?: Nullish<string>
    ) {
        if (
            authTokenUriOrPresentationRequest instanceof VCLPresentationRequest
        ) {
            // Called with a VCLPresentationRequest.
            this.authTokenUri = authTokenUriOrPresentationRequest.authTokenUri;
            this.refreshToken = refreshToken;
            this.walletDid = authTokenUriOrPresentationRequest.didJwk.did;
            this.relyingPartyDid = authTokenUriOrPresentationRequest.iss;
            this.authorizationCode =
                authTokenUriOrPresentationRequest.vendorOriginContext;
        } else {
            // Called with tokenUrl, walletDid, relyingPartyDid, etc.
            this.authTokenUri = authTokenUriOrPresentationRequest;
            this.walletDid = walletDid;
            this.relyingPartyDid = relyingPartyDid;
            this.authorizationCode = vendorOriginContext;
            this.refreshToken = refreshToken;
        }
    }

    generateRequestBody(): Dictionary<any> {
        return this.refreshToken
            ? {
                  [VCLAuthTokenDescriptor.KeyGrantType]:
                      GrantType.RefreshToken.toString(),
                  [VCLAuthTokenDescriptor.KeyClientId]: this.walletDid,
                  [GrantType.RefreshToken]: this.refreshToken,
                  [VCLAuthTokenDescriptor.KeyAudience]: this.relyingPartyDid,
              }
            : {
                  [VCLAuthTokenDescriptor.KeyGrantType]:
                      GrantType.AuthorizationCode.toString(),
                  [VCLAuthTokenDescriptor.KeyClientId]: this.walletDid,
                  [GrantType.AuthorizationCode.toString()]:
                      this.authorizationCode,
                  [VCLAuthTokenDescriptor.KeyAudience]: this.relyingPartyDid,
                  [VCLAuthTokenDescriptor.KeyTokenType]:
                      VCLAuthTokenDescriptor.KeyTokenTypeValue,
              };
    }

    static readonly KeyClientId = 'client_id';

    static readonly KeyAudience = 'audience';

    static readonly KeyGrantType = 'grant_type';

    static readonly KeyTokenType = 'token_type';

    static readonly KeyTokenTypeValue = 'Bearer';
}
