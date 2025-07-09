import VCLPublicJwk from '../../src/api/entities/VCLPublicJwk';
import { JwtMocks } from '../infrastructure/resources/valid/JwtMocks';

describe('VCLPublicJwk Tests', () => {
    let subject: VCLPublicJwk;
    const jwkJson = JSON.parse(JwtMocks.JWK);

    test('testPublicJwkFromStr', () => {
        subject = VCLPublicJwk.fromString(JwtMocks.JWK);

        expect(subject.valueStr).toEqual(JwtMocks.JWK);
    });

    test('testPublicJwkFromJson', () => {
        subject = VCLPublicJwk.fromJSON(jwkJson);

        expect(subject.valueJson).toEqual(jwkJson);
    });
});
