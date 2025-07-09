import { Nullish } from '../VCLTypes';
import VCLJwt from './VCLJwt';

export default class VCLToken {
    /**
     * token value represented as jwt string
     */
    public readonly value: string;

    /**
     * token value represented as VCLJwt object
     */
    public readonly jwtValue: VCLJwt;

    constructor(value: string | VCLJwt) {
        if (typeof value === 'string') {
            this.value = value;
            this.jwtValue = VCLJwt.fromEncodedJwt(value);
        } else {
            this.value = value?.encodedJwt ?? '';
            this.jwtValue = value ?? VCLJwt.fromEncodedJwt('');
        }
    }

    /**
     * token expiration period in milliseconds
     */
    public get expiresIn(): Nullish<bigint> {
        return BigInt(this.jwtValue.payload[VCLToken.KeyExp]);
    }

    static readonly KeyExp = 'exp';
}
