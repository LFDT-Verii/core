import VCLToken from '../../src/api/entities/VCLToken';
import TokenMocks from '../infrastructure/resources/valid/TokenMocks';

describe('VCLToken Tests', () => {
    let subject: VCLToken;

    test('testToken1', () => {
        subject = new VCLToken(TokenMocks.TokenStr1);

        expect(subject.value).toEqual(TokenMocks.TokenStr1);
        expect(subject.jwtValue.encodedJwt).toEqual(TokenMocks.TokenStr1);
        expect(subject.expiresIn).toEqual(BigInt(1704020514));
    });

    test('testToken2', () => {
        subject = new VCLToken(TokenMocks.TokenJwt1);

        expect(subject.value).toEqual(TokenMocks.TokenJwt1.encodedJwt);
        expect(subject.jwtValue.encodedJwt).toEqual(
            TokenMocks.TokenJwt1.encodedJwt
        );
        expect(subject.expiresIn).toEqual(BigInt(1704020514));
    });
});
