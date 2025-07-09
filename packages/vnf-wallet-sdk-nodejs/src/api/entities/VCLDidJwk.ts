// eslint-disable-next-line max-classes-per-file
import { base64url, exportJWK } from 'jose';
import { KeyPairKeyObjectResult } from 'crypto';
import canonicalize from 'canonicalize';
import VCLPublicJwk from './VCLPublicJwk';
import { Dictionary } from '../VCLTypes';

export default class VCLDidJwk {
    private constructor(
        public readonly payload: Dictionary<any>,
        public readonly did: string,
        public readonly publicJwk: VCLPublicJwk,
        public readonly kid: string,
        public readonly keyId: string
    ) {}

    // companion object
    static readonly DidJwkPrefix = 'did:jwk:';

    static readonly DidJwkSuffix = '#0';

    static readonly KeyDid = 'did';

    static readonly KeyKid = 'kid';

    static readonly KeyKeyId = 'keyId';

    static readonly KeyPublicJwk = 'publicJwk';

    static Utils = class {
        static generateDidJwk = async (ecKey: KeyPairKeyObjectResult) => {
            const publicJwk = await exportJWK(ecKey.publicKey);
            return `${VCLDidJwk.DidJwkPrefix}${base64url.encode(
                canonicalize(publicJwk)!
            )}`;
        };

        static generateKidFromDidJwk = (ecKey: KeyPairKeyObjectResult) => {
            return `${this.generateDidJwk(ecKey)}${VCLDidJwk.DidJwkSuffix}`;
        };
    };

    public static fromString(didJwkStr: string): VCLDidJwk {
        return VCLDidJwk.fromJSON(JSON.parse(didJwkStr));
    }

    public static fromJSON(didJwkJson: Dictionary<any>): VCLDidJwk {
        return new VCLDidJwk(
            didJwkJson,
            didJwkJson[VCLDidJwk.KeyDid],
            VCLPublicJwk.fromJSON(didJwkJson[VCLDidJwk.KeyPublicJwk]),
            didJwkJson[VCLDidJwk.KeyKid],
            didJwkJson[VCLDidJwk.KeyKeyId]
        );
    }
}
