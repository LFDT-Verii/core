/* eslint-disable max-len */

import { describe, test } from 'node:test';
import { expect } from 'expect';

import VCLDidJwk from '../../src/api/entities/VCLDidJwk';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';

describe('VCLDidJwk Tests', () => {
    let subject: VCLDidJwk;
    const expectedPayload = DidJwkMocks.DidJwkJson;
    const expectedDid =
        'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6InI5ZnlhNTJJbG1UbzN5YlMwd19HZWZlUV9SWDJFSF9ISm1TV3FZWU8ySlkiLCJ5IjoicFFUUmE3R2txYzVrajZvZGVNcXBnVjVUNExqYlphNEY1S1R1MkpEclduYyJ9';
    const expectedKid =
        'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6InI5ZnlhNTJJbG1UbzN5YlMwd19HZWZlUV9SWDJFSF9ISm1TV3FZWU8ySlkiLCJ5IjoicFFUUmE3R2txYzVrajZvZGVNcXBnVjVUNExqYlphNEY1S1R1MkpEclduYyJ9#0';
    const expectedKeyId = '6630f0a67b097c289711f583';
    const expectedPublicJwk = {
        kty: 'EC',
        crv: 'P-256',
        y: 'pQTRa7Gkqc5kj6odeMqpgV5T4LjbZa4F5KTu2JDrWnc',
        x: 'r9fya52IlmTo3ybS0w_GefeQ_RX2EH_HJmSWqYYO2JY',
    };

    test('testPublicJwkFromStr', () => {
        subject = VCLDidJwk.fromString(DidJwkMocks.DidJwkStr);

        expect(subject.payload).toStrictEqual(expectedPayload);
        expect(subject.did).toEqual(expectedDid);
        expect(subject.kid).toEqual(expectedKid);
        expect(subject.keyId).toEqual(expectedKeyId);
        expect(subject.publicJwk.valueJson).toStrictEqual(expectedPublicJwk);
    });

    test('testPublicJwkFromJson', () => {
        subject = VCLDidJwk.fromJSON(DidJwkMocks.DidJwkJson);

        expect(subject.payload).toStrictEqual(expectedPayload);
        expect(subject.did).toEqual(expectedDid);
        expect(subject.kid).toEqual(expectedKid);
        expect(subject.keyId).toEqual(expectedKeyId);
        expect(subject.publicJwk.valueJson).toStrictEqual(expectedPublicJwk);
    });
});
