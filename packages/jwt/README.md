# @verii/jwt

Set of JWT related functions used in Verii projects

## Installation

```bash
yarn add @verii/jwt
```

## Usage

```js
const { base64UrlToJwk, buildDecodedCredential, buildDecodedPresentation } = require('@verii/jwt');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `base64UrlToJwk`
- `buildDecodedCredential`
- `buildDecodedPresentation`
- `decodeCredentialJwt`
- `decodePresentationJwt`
- `deriveJwk`
- `generateCredentialJwt`
- `generateDocJwt`
- `generatePresentationJwt`
- `getExpirationISODate`
- `getIssuerId`
- `hexFromJwk`
- `hexToJwkKeyTransformer`
- `jsonLdToUnsignedVcJwtContent`
- `jwkFromSecp256k1Key`
- `jwkFromStringified`
- `jwkThumbprint`
- `jwkToPublicBase64Url`
- `jwsVerify`
- `jwtDecode`
- ... and 13 more (see `index.js`)

## Development

Run from the repository root:

```bash
yarn workspace @verii/jwt test
yarn workspace @verii/jwt lint
```

