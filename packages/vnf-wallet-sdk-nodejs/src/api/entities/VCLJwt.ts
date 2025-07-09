// eslint-disable-next-line max-classes-per-file
import { Dictionary, Nullish } from '../VCLTypes';
import VCLLog from '../../impl/utils/VCLLog';

export default class VCLJwt {
    public encodedJwt: string;

    public header: Dictionary<any>;

    public payload: Dictionary<any>;

    public signature: string;

    constructor(public signedJwt: SignedJWT) {
        this.signedJwt = signedJwt;
        this.encodedJwt = signedJwt.serialize();

        this.header = this.getHeader();
        this.payload = this.getPayload();
        this.signature = this.getSignature();
    }

    static fromEncodedJwt(encodedJwt: string): VCLJwt {
        let item = new VCLJwt(new SignedJWT('', '', ''));
        try {
            const encodedJwtArr = encodedJwt.split('.');
            item = new VCLJwt(
                new SignedJWT(
                    encodedJwtArr[0] ?? '',
                    encodedJwtArr[1] ?? '',
                    encodedJwtArr[2] ?? ''
                )
            );
        } catch (e) {
            VCLLog.error(e);
        }
        return item;
    }

    get kid(): string {
        return this.header.kid ?? this.jwk.kid ?? '';
    }

    get jwk(): Dictionary<any> {
        return this.header.jwk ?? {};
    }

    getHeader(): Dictionary<any> {
        const buff = Buffer.from(this.signedJwt.header, 'base64');
        const text = buff.toString('utf-8');
        return JSON.parse(text || '{}');
    }

    getPayload(): Dictionary<any> {
        const buff = Buffer.from(this.signedJwt.payload, 'base64');
        const text = buff.toString('utf-8');
        return JSON.parse(text || '{}');
    }

    getSignature(): string {
        return this.signedJwt.signature;
    }

    get iss(): Nullish<string> {
        return this.payload[CodingKeys.KeyIss];
    }

    get aud(): Nullish<string> {
        return this.payload[CodingKeys.KeyAud];
    }

    get sub(): Nullish<string> {
        return this.payload[CodingKeys.KeySub];
    }

    get jti(): Nullish<string> {
        return this.payload[CodingKeys.KeyJti];
    }

    get iat(): Nullish<string> {
        return this.payload[CodingKeys.KeyIat];
    }

    get nbf(): Nullish<string> {
        return this.payload[CodingKeys.KeyNbf];
    }

    get exp(): Nullish<string> {
        return this.payload[CodingKeys.KeyExp];
    }

    get nonce(): Nullish<string> {
        return this.payload[CodingKeys.KeyNonce];
    }
}

export class SignedJWT {
    constructor(
        public readonly header: string,
        public readonly payload: string,
        public readonly signature: string
    ) {}

    static parse(s: string): Nullish<SignedJWT> {
        const splitted = s.split('.');
        return new SignedJWT(
            splitted[0] ?? '',
            splitted[1] ?? '',
            splitted[2] ?? ''
        );
    }

    serialize() {
        const items = [this.header, this.payload, this.signature].filter(
            (item) => item.length
        );
        return items.join('.');
    }
}

class CodingKeys {
    static readonly KeyTyp = 'typ';

    static readonly KeyAlg = 'alg';

    static readonly KeyKid = 'kid';

    static readonly KeyJwk = 'jwk';

    static readonly KeyX = 'x';

    static readonly KeyY = 'y';

    static readonly KeyHeader = 'header';

    static readonly KeyPayload = 'payload';

    static readonly KeySignature = 'signature';

    static readonly KeyIss = 'iss';

    static readonly KeyAud = 'aud';

    static readonly KeySub = 'sub';

    static readonly KeyJti = 'jti';

    static readonly KeyIat = 'iat';

    static readonly KeyNbf = 'nbf';

    static readonly KeyExp = 'exp';

    static readonly KeyNonce = 'nonce';
}
