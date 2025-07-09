import { VCLDidJwk } from '../../../../src';
/* eslint-disable max-len */

class DidJwkMocks {
    static readonly DidJwkStr =
        '{ "did": "did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6InI5ZnlhNTJJbG1UbzN5YlMwd19HZWZlUV9SWDJFSF9ISm1TV3FZWU8ySlkiLCJ5IjoicFFUUmE3R2txYzVrajZvZGVNcXBnVjVUNExqYlphNEY1S1R1MkpEclduYyJ9", "kid": "did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6InI5ZnlhNTJJbG1UbzN5YlMwd19HZWZlUV9SWDJFSF9ISm1TV3FZWU8ySlkiLCJ5IjoicFFUUmE3R2txYzVrajZvZGVNcXBnVjVUNExqYlphNEY1S1R1MkpEclduYyJ9#0", "keyId": "6630f0a67b097c289711f583", "publicJwk": { "kty": "EC", "crv": "P-256", "y": "pQTRa7Gkqc5kj6odeMqpgV5T4LjbZa4F5KTu2JDrWnc", "x": "r9fya52IlmTo3ybS0w_GefeQ_RX2EH_HJmSWqYYO2JY" } }';

    static readonly DidJwkJson = {
        did: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6InI5ZnlhNTJJbG1UbzN5YlMwd19HZWZlUV9SWDJFSF9ISm1TV3FZWU8ySlkiLCJ5IjoicFFUUmE3R2txYzVrajZvZGVNcXBnVjVUNExqYlphNEY1S1R1MkpEclduYyJ9',
        kid: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6InI5ZnlhNTJJbG1UbzN5YlMwd19HZWZlUV9SWDJFSF9ISm1TV3FZWU8ySlkiLCJ5IjoicFFUUmE3R2txYzVrajZvZGVNcXBnVjVUNExqYlphNEY1S1R1MkpEclduYyJ9#0',
        keyId: '6630f0a67b097c289711f583',
        publicJwk: {
            kty: 'EC',
            crv: 'P-256',
            y: 'pQTRa7Gkqc5kj6odeMqpgV5T4LjbZa4F5KTu2JDrWnc',
            x: 'r9fya52IlmTo3ybS0w_GefeQ_RX2EH_HJmSWqYYO2JY',
        },
    };

    static readonly DidJwk = VCLDidJwk.fromJSON(DidJwkMocks.DidJwkJson);
}

export { DidJwkMocks };
