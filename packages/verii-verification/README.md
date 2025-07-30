# Verii Verification Library

The Verii Verification Library provides utility functions for verifying Verifiable Credentials (VCs) and Verifiable Presentations (VPs) according to the Verii and Velocity Network specifications. It includes logic for cryptographic validation, protocol version support, and key resolution via DIDs.

## 📦 Installation

```bash
npm install @velocitycareerlabs/verii-verification
```

## 🚀 Main Entry Points

### 1. `verifyCredentials`

Verifies one or more Verifiable Credentials (VCs) in JWT format.

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
//       ... // The jwt's `payload.vc` value (ie. the unsigned jsonld representation of the VC) 
//     }, 
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

### 2. `verifyVerifiablePresentationJwt`

Verifies a Verifiable Presentation (VP) in JWT format, optionally using protocol-aware key resolution. Returns the
unsigned VP.

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
