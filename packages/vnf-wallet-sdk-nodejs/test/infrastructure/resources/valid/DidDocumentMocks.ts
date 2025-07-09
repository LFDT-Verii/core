/* eslint-disable max-len */
/**
 * Created by Michael Avoyan on 05/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLDidDocument from '../../../../src/api/entities/VCLDidDocument';

export class DidDocumentMocks {
    static readonly DidDocumentMockStr =
        '{"id":"did:web:devregistrar.velocitynetwork.foundation:d:example-21.com-8b82ce9a","@context":["https://www.w3.org/ns/did/v1"],"verificationMethod":[{"id":"#key-1","type":"JsonWebKey2020","controller":"did:web:stagingregistrar.velocitynetwork.foundation:d:example-2.com","publicKeyJwk":{"crv":"secp256k1","kty":"EC","x":"ysD1vLc7sPdb9w8l4k4PYPKHCJQ8p1kPuWJ2SPljgqE","y":"Au6CfY-T5ksLk1rzeL7DD1lMCg3bWvn6R00A589vZq0"}},{"id":"#vc-signing-key-1","type":"JsonWebKey2020","controller":"did:web:devregistrar.velocitynetwork.foundation:d:example-21.com","publicKeyJwk":{"crv":"secp256k1","kty":"EC","x":"zxjdUmqrJT05dWoxs90Pul3s-e1vA-RNHmBIIovrpCo","y":"SrL1KvHPao0HzTopTo6NehpUu3HCFJl9rrMO8w7ANxo"}},{"id":"#eth-account-key-1","type":"JsonWebKey2020","controller":"did:web:devregistrar.velocitynetwork.foundation:d:example-21.com","publicKeyJwk":{"crv":"secp256k1","kty":"EC","x":"B4dMEhADxRkR_V5Bagw7LKBHS9Fmm8GcKQZDIQzJqSM","y":"tLHI5-_HPqeyvWSVMMeQkVUnUSPusWV_bsCppZXCKFI"}},{"id":"#exchange-key-1","type":"JsonWebKey2020","controller":"did:web:devregistrar.velocitynetwork.foundation:d:example-21.com","publicKeyJwk":{"crv":"secp256k1","kty":"EC","x":"AgczeAUIFv7Edpa28Looj9vl2UezUzy5Cpvty9Y5CwI","y":"FTYMesyp7901_9LAdvJBVfhsYQtaAPCirp7cBfc3wQU"}}],"assertionMethod":["#vc-signing-key-1","#eth-account-key-1","#exchange-key-1"],"alsoKnownAs":["did:ion:EiBMsw27IKRYIdwUOfDeBd0LnWVeG2fPxxJi9L1fvjM20g", "did:ion:EiBWHq6-McOWHYi1slsQ7VeOtHEMUkcrIw7Jt2uPbft_gg", "did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692", "did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA"],"service":[{"type":"VlcInspector_v1","id":"#vlc-inspector-1","serviceEndpoint":"https://devagent.velocitycareerlabs.io"},{"type":"VlcCareerIssuer_v1","id":"#vlc-issuer-1","serviceEndpoint":"https://devagent.velocitycareerlabs.io"}]}';

    static readonly DidDocumentWithWrongDidMockStr =
        '{"id":"did:web:devregistrar.velocitynetwork.foundation:d:example-21.com-8b82ce9a","@context":["https://www.w3.org/ns/did/v1"],"verificationMethod":[{"id":"#vc-signing-key-1","type":"JsonWebKey2020","controller":"did:web:devregistrar.velocitynetwork.foundation:d:example-21.com","publicKeyJwk":{"crv":"secp256k1","kty":"EC","x":"zxjdUmqrJT05dWoxs90Pul3s-e1vA-RNHmBIIovrpCo","y":"SrL1KvHPao0HzTopTo6NehpUu3HCFJl9rrMO8w7ANxo"}},{"id":"#eth-account-key-1","type":"JsonWebKey2020","controller":"did:web:devregistrar.velocitynetwork.foundation:d:example-21.com","publicKeyJwk":{"crv":"secp256k1","kty":"EC","x":"B4dMEhADxRkR_V5Bagw7LKBHS9Fmm8GcKQZDIQzJqSM","y":"tLHI5-_HPqeyvWSVMMeQkVUnUSPusWV_bsCppZXCKFI"}},{"id":"#exchange-key-1","type":"JsonWebKey2020","controller":"did:web:devregistrar.velocitynetwork.foundation:d:example-21.com","publicKeyJwk":{"crv":"secp256k1","kty":"EC","x":"AgczeAUIFv7Edpa28Looj9vl2UezUzy5Cpvty9Y5CwI","y":"FTYMesyp7901_9LAdvJBVfhsYQtaAPCirp7cBfc3wQU"}}],"assertionMethod":["#vc-signing-key-1","#eth-account-key-1","#exchange-key-1"],"alsoKnownAs":["wrong did"],"service":[{"type":"VlcInspector_v1","id":"#vlc-inspector-1","serviceEndpoint":"https://devagent.velocitycareerlabs.io"},{"type":"VlcCareerIssuer_v1","id":"#vlc-issuer-1","serviceEndpoint":"https://devagent.velocitycareerlabs.io"}]}';

    static readonly DidDocumentMock = new VCLDidDocument(
        DidDocumentMocks.DidDocumentMockStr
    );

    static readonly DidDocumentWithWrongDidMock = new VCLDidDocument(
        DidDocumentMocks.DidDocumentWithWrongDidMockStr
    );
}
