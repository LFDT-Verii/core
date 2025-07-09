import { Dictionary } from '../VCLTypes';
import VCLPublicJwk from './VCLPublicJwk';

/**
 * Created by Michael Avoyan on 04/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

export default class VCLDidDocument {
    payload: Dictionary<any>;

    constructor(payload: Dictionary<any>);

    constructor(payloadStr: string);

    constructor(payloadOrStr: Dictionary<any> | string) {
        if (typeof payloadOrStr === 'string') {
            try {
                this.payload = JSON.parse(payloadOrStr);
            } catch {
                this.payload = {};
            }
        } else {
            this.payload = payloadOrStr;
        }
    }

    getPublicJwk(kid: string): VCLPublicJwk | null {
        if (!kid.includes('#')) return null;

        const publicJwkId = `#${kid.split('#')[1]}`;
        const verificationMethod =
            (this.payload?.[
                VCLDidDocument.KeyVerificationMethod
            ] as Dictionary<any>[]) ?? [];

        const publicJwkPayload = verificationMethod
            .filter(
                (item): item is Record<string, any> =>
                    typeof item === 'object' && item !== null
            )
            .find((method) => method[VCLDidDocument.KeyId] === publicJwkId);

        const publicJwk = publicJwkPayload?.[VCLDidDocument.KeyPublicKeyJwk];
        return publicJwk ? VCLPublicJwk.fromJSON(publicJwk) : null;
    }

    get id(): string {
        return this.payload[VCLDidDocument.KeyId] || '';
    }

    get alsoKnownAs(): string[] {
        const value = this.payload[VCLDidDocument.KeyAlsoKnownAs];
        return Array.isArray(value) ? value : [];
    }

    static KeyId = 'id';

    static KeyAlsoKnownAs = 'alsoKnownAs';

    static KeyVerificationMethod = 'verificationMethod';

    static KeyPublicKeyJwk = 'publicKeyJwk';
}
