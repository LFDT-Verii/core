/* eslint-disable max-len */

import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLJwt from '../../src/api/entities/VCLJwt';

const jwtWtithKidStr =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNvbWVfa2lkIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.lGqyFj2RpmostxLvCcMFym9kWM0bzQcty9a81EdzrhM';
const jwtWtihJwkStr =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImp3ayI6eyJrdHkiOiJSU0EiLCJ1c2UiOiJzaWciLCJraWQiOiJzb21lX2tpZCIsIm4iOiJ6ZzctOGFZcnh1VjdINHQuLi4iLCJlIjoiQVFBQiJ9fQ.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.ijeuQTlhK7jpYkRmD_yWFKtluFWLEhjdieZJxkTc9fY';

describe('test jwt', () => {
    test('empty jwt', async () => {
        const subject = VCLJwt.fromEncodedJwt('');

        expect(subject.header).toStrictEqual({});
        expect(subject.payload).toStrictEqual({});
        expect(subject.signature).toStrictEqual('');
        expect(subject.encodedJwt).toStrictEqual('');
        expect(subject.jwk).toStrictEqual({});
        expect(subject.kid).toStrictEqual('');
    });

    test('valid jwt with kid', async () => {
        const subject = VCLJwt.fromEncodedJwt(jwtWtithKidStr);

        expect(subject.header).toStrictEqual(
            JSON.parse('{"alg":"HS256","typ":"JWT","kid":"some_kid"}')
        );
        expect(subject.payload).toStrictEqual(
            JSON.parse(
                '{"sub":"1234567890","name":"John Doe","iat":1516239022}'
            )
        );
        expect(subject.signature).toStrictEqual(
            'lGqyFj2RpmostxLvCcMFym9kWM0bzQcty9a81EdzrhM'
        );
        expect(subject.encodedJwt).toStrictEqual(jwtWtithKidStr);
        expect(subject.jwk).toStrictEqual({});
        expect(subject.kid).toStrictEqual('some_kid');
    });

    test('valid jwt with jwk', async () => {
        const subject = VCLJwt.fromEncodedJwt(jwtWtihJwkStr);

        expect(subject.header).toStrictEqual(
            JSON.parse(
                '{"alg":"HS256","typ":"JWT","jwk":{"kty":"RSA","use":"sig","kid":"some_kid","n":"zg7-8aYrxuV7H4t...","e":"AQAB"}}'
            )
        );
        expect(subject.payload).toStrictEqual(
            JSON.parse(
                '{"sub":"1234567890","name":"John Doe","iat":1516239022}'
            )
        );
        expect(subject.signature).toStrictEqual(
            'ijeuQTlhK7jpYkRmD_yWFKtluFWLEhjdieZJxkTc9fY'
        );
        expect(subject.encodedJwt).toStrictEqual(jwtWtihJwkStr);
        expect(subject.jwk).toStrictEqual(
            JSON.parse(
                '{"kty":"RSA","use":"sig","kid":"some_kid","n":"zg7-8aYrxuV7H4t...","e":"AQAB"}'
            )
        );
        expect(subject.kid).toStrictEqual('some_kid');
    });
});
