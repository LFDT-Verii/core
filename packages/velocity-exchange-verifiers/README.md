# Credential Verifier Library

A TypeScript library for validating Verifiable Credentials (VCs) issued via the [OpenID for Verifiable Credential Issuance (OpenID4VCI)](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) protocol with strict conformance to the **Velocity Profile**.

## Features

- ✅ Modular and composable verifier functions  
- ✅ Full support for OpenID4VCI issuance flows  
- ✅ Velocity Profile conformance: algorithm checks, issuer rules, key prefixes, subject binding  
- ✅ Strict error tracing using `VerificationContext` path hierarchy  
- ✅ Fully documented using [TSDoc](https://tsdoc.org/)

## Installation

```bash
npm install your-verifier-library
# or
yarn add your-verifier-library
```

## Usage

```ts
import {
  verifyCredentialEndpointResponse,
  CredentialJwt,
  VerificationContext,
} from 'your-verifier-library';

const context: VerificationContext = {
  credential_issuer_metadata: {
    iss: 'did:velocity:issuer',
    credential_issuer: 'https://issuer.example.com',
  },
};

const response = await fetch('/credential-endpoint').then((res) => res.json());

const errors = verifyCredentialEndpointResponse(response, context);

if (errors.length > 0) {
  console.error('Credential validation failed:', errors);
} else {
  console.log('Credential is valid.');
}
```

## Key Concepts

### `Verifier<T>`

A pure function that checks a value of type `T` against one or more validation rules using shared context.

```ts
export type Verifier<T> = (
  value: T,
  context: VerificationContext
) => VerificationError[];
```

### `VerificationContext`

Holds shared metadata and trace path information to support precise validation.

```ts
export type VerificationContext = {
  credential_issuer_metadata?: {
    iss: string;
    credential_issuer?: string;
  };
  response?: unknown;
  path?: Array<string | number>;
};
```

### `VerificationError`

Represents a structured validation failure.

```ts
export type VerificationError = {
  code: string;
  message: string;
  path?: Array<string | number>;
};
```

## Built-in Verifiers

- `algIsSupportedVerifier`  
- `credentialSchemaVerifier`  
- `credentialStatusVerifier`  
- `issClaimMatchesMetadataVerifier`  
- `issClaimMatchesEitherMetadataOrCredentialIssuerVerifier`  
- `kidClaimIsVelocityV2Verifier`  
- `subIsDidJwkOrCnfVerifier`  

## Dev & Test

```bash
# install dependencies
yarn install

# run tests
yarn test
```

## License

Apache 2.0 © 2022 Velocity Career Labs Inc.

## Contributing

Pull requests are welcome. Ensure your changes are covered by tests and use TSDoc for all exported types and functions.
