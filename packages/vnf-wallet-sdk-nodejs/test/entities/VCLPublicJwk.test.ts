import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLPublicJwk from '../../src/api/entities/VCLPublicJwk';
import { JwtMocks } from '../infrastructure/resources/valid/JwtMocks';

describe('VCLPublicJwk', () => {
    let subject: VCLPublicJwk;
    const jwkJson = JSON.parse(JwtMocks.JWK);

    test('creates a public JWK from a string', () => {
        subject = VCLPublicJwk.fromString(JwtMocks.JWK);

        expect(subject.valueStr).toEqual(JwtMocks.JWK);
    });

    test('creates a public JWK from json', () => {
        subject = VCLPublicJwk.fromJSON(jwkJson);

        expect(subject.valueJson).toEqual(jwkJson);
    });
});
