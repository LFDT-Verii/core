/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import VCLToken from './VCLToken';
import { Dictionary, Nullish } from '../VCLTypes';

export default class VCLAuthToken {
    public accessToken: VCLToken;

    public refreshToken: VCLToken;

    public tokenType: string;

    constructor(
        public readonly payload: Dictionary<any>,
        public readonly authTokenUri?: string,
        public readonly walletDid?: Nullish<string>,
        public readonly relyingPartyDid?: Nullish<string>
    ) {
        this.accessToken = new VCLToken(payload.access_token);
        this.refreshToken = new VCLToken(payload.refresh_token);
        this.tokenType = payload.token_type;
        this.authTokenUri = authTokenUri ?? payload.authTokenUri;
        this.walletDid = walletDid ?? payload.walletDid;
        this.relyingPartyDid = relyingPartyDid ?? payload.relyingPartyDid;
    }
}
