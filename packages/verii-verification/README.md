# Verii Verification Library

The Verii Verification Library provides utility functions for verifying Verifiable Credentials (VCs) and Verifiable Presentations (VPs) according to the Verii and Velocity Network specifications. It includes logic for cryptographic validation, protocol version support, and key resolution via DIDs.

## 📦 Installation

```bash
npm install @velocitycareerlabs/verii-verification
```

## 🚀 Main Entry Points

### 1. `verifyCredentials`

Verifies one or more compact Verifiable Credentials. The verifier accepts the
legacy VC 1.1 `jwt_vc_json-ld` envelope and the direct VC 2.0 `vc+jwt`
envelope, and reports which profile and signing algorithm it verified.

VC 2.0 results also expose the JWT verifier's separate `proof`, `conformance`,
and `policy` assessments. During the compatibility period, any failure in
those assessments is also translated to `credentialChecks.UNTAMPERED: 'FAIL'`.
The `credential` property is omitted when proof, conformance, or policy fails.
The Velocity profile is defined once, at its enforcement layer, in the
[`@verii/jwt` README](../jwt/README.md#velocity-vc-20-profile).

```ts
import { verifyCredentials } from '@velocitycareerlabs/verii-verification';

const credentials = [
  "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...", // JWT-encoded Verifiable Credential
];

// The KMS abstraction requires a exportKeyOrSecret function
const kms = {
    exportKeyOrSecret(keyId) {
        // ... exports the private key from the kms
    }
};

async function authenticator () {
    const token = authenticate()// Fetch an access token from an OAuth provider using the client_credential grant type
    return token
}

const config = {
    rootPublicKey: "0x899ef1cc48d17ee2701b25b14203d45e15bb01d07767450e9191ea71760d558a", // TRUST Root Private key
    revocationContractAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // DLT address for revocation address
    metadataRegistryContractAddress: "0x3f5CE5FBFe3E9af3971dD833D26BA9b5C936f0bE", // DLT address for VC metadata
    rpcProvider: initProvider("http://localhost:8545", authenticator),
    registrarUrl: "https://registrar.velocitynetwork.foundation",
}

const context = {
    kms,
    log, // a logger that exposes a pino logger
    config,
}

const verified = await verifyVeriiCredentials(
    {
        credentials,
        expectedHolderDid: "did:jwk:eyJrdHkiOiJFQyIsInVzZSI6InNpZyIsImNydiI6I...",
        relyingParty: { did: "did:web:example.com", dltOperatorKMSKeyId: "df9c4f12-3d79-4ab6-88ef-91b4eae45eaf" },
    },
    context
);

console.log(verified);
// [
//   { 
//     credential: 
//     { 
//       ... // The normalized, signature-verified VC document
//     }, 
//     dataModelVersion: '1.1',
//     envelopeFormat: 'jwt_vc_json-ld',
//     signingAlgorithm: 'ES256K',
//     credentialChecks: {      
//       UNTAMPERED: 'PASS',
//       TRUSTED_ISSUER: 'PASS',
//       TRUSTED_HOLDER: 'PASS',
//       UNEXPIRED: 'PASS',
//       UNREVOKED: 'PASS' 
//     }
//   },
//   ...
// ]
```

A successful VC 2.0 entry additionally contains:

```js
{
  proof: { status: 'PASS', errors: [] },
  conformance: { status: 'PASS', errors: [], warnings: [] },
  policy: {
    status: 'PASS',
    profile: 'velocity-vc-v2',
    errors: [],
    warnings: []
  }
}
```

#### Signature validity, self-signed status, and issuer authentication

`credentialChecks.UNTAMPERED` reports whether the signature (and, for VC 2.0,
the `@verii/jwt` proof, conformance, and policy assessments) verified with the
discovered key. A valid signature proves possession of that key; it does not
authenticate the claimed issuer. `credentialChecks.TRUSTED_ISSUER` reports how
the claimed issuer (`issuer` or `issuer.id`; `iss` for VC 1.1) is bound to that
key:

- `PASS`: the issuer is authenticated and authorized. Only `did:velocity`
  credentials can reach `PASS`, through the ledger-bound issuer credential and
  registrar accreditation for the credential type.
- `SELF_SIGNED`: the issuer is a self-certifying `did:jwk` derived from the
  exact verification JWK. The issuer controls the key, but nothing vouches for
  the issuer.
- `DATA_INTEGRITY_ERROR`: the credential claims a `did:jwk` binding that does
  not hold, for example a `did:jwk` `kid` whose DID is not the issuer, or a
  `did:jwk` issuer that is not derived from the verification JWK.
- `FAIL`: the issuer is not authenticated. This includes an embedded `jwk`
  with any issuer other than its own `did:jwk`; Career Wallet self-reported
  credentials, which use a UUID `iss`, fall into this case.

Keys are discovered from the protected header:

| Protected header | Verification key | Issuer binding |
| --- | --- | --- |
| `kid` is a `did:velocity` DID URL | Resolved from the credential metadata ledger | Ledger-bound issuer credential and registrar accreditation |
| `kid` is a `did:jwk` DID URL | The JWK encoded in the DID | Issuer must be that `did:jwk` |
| `kid` uses another DID method | Not resolved (`UNTAMPERED: DEPENDENCY_RESOLUTION_ERROR`) | Not checked |
| `kid` does not resolve to a verification method | None (`UNTAMPERED: DATA_INTEGRITY_ERROR`) | Not checked |
| No `kid`, embedded `jwk` | The embedded `jwk` | Issuer must be the `did:jwk` derived from that `jwk` |

A supplied `kid` is authoritative: the verifier never falls back to an
embedded `jwk` when the `kid` cannot be resolved or resolves to a different
key. A `did:jwk` is derived from a JWK with `getDidUriFromJwk` from
`@verii/did-doc`, which encodes the JCS-canonicalized JWK exactly as received,
including any non-key members. For VC 2.0, a `did:jwk` `kid` whose DID is not
the issuer fails earlier, in `@verii/jwt` conformance
(`CREDENTIAL_SELF_SIGNED_ISSUER_INVALID`), and is reported as
`UNTAMPERED: FAIL`.

### 2. `verifyVerifiablePresentationJwt`

Verifies a Verifiable Presentation (VP) in JWT format, optionally using protocol-aware key resolution. Returns the
unsigned VP.

Detailed protocol-v1/protocol-v2 rules, header requirements, and the mixed
`kid` + `jwk` deprecation are documented in
[`verify-presentation-jwt.README.md`](./verify-presentation-jwt.README.md).

```ts
import { verifyVerifiablePresentationJwt } from '@velocitycareerlabs/verii-verification';

const vpJwt = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...";

const result = await verifyVerifiablePresentationJwt(vpJwt, {
  vnfProtocolVersion: 2
});

console.log(result);
// {
//    ... // returns the JWT's payload.vp claim (ie. the unsigned jsonld representation of the VP)
// }
```

## 🛠 Dependencies

- DID resolution via `@verii/did-doc`
- JWT operations via `@verii/jwt`
- Verii protocol version constants from `@verii/vc-checks`

### Peer Dependencies
- Pino logger from https://github.com/pinojs/pino

## 🧪 Error Handling

Malformed or unverifiable inputs will throw `http-errors` with structured metadata:

```ts
throw createError(400, "Malformed jwt_vp property", {
  errorCode: 'presentation_malformed',
});
```

## 📘 License

Licensed under the Apache 2.0 License. See [LICENSE](./LICENSE) for details.
