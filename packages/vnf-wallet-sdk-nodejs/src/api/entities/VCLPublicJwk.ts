import { Dictionary } from '../VCLTypes';

// eslint-disable-next-line no-shadow
enum Format {
    jwk = 'jwk',
    hex = 'hex',
    pem = 'pem',
    base58 = 'base58',
}

export default class VCLPublicJwk {
    private constructor(
        public valueStr: string,
        public valueJson: Dictionary<any>
    ) {}

    static readonly Format = Format;

    get curve(): string {
        return this.valueJson.crv;
    }

    public static fromString(valueStr: string) {
        return new VCLPublicJwk(valueStr, JSON.parse(valueStr));
    }

    public static fromJSON(valueJson: Dictionary<any>) {
        return new VCLPublicJwk(JSON.stringify(valueJson), valueJson);
    }
}
