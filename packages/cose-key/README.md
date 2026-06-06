# @verii/cose-key

Set of cose key functions used in Verii projects

## Installation

```bash
yarn add @verii/cose-key
```

## Usage

```js
const { Algorithms, CBORTags, CWTClaims } = require('@verii/cose-key');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `Algorithms`
- `CBORTags`
- `CWTClaims`
- `CoseKey`
- `EC2KeyParameters`
- `EllipticCurves`
- `HSSLMSKeyParameters`
- `HeaderAlgorithmParameters`
- `HeaderParameters`
- `KeyOperations`
- `KeyParameters`
- `KeyTypes`
- `OKPKeyParameters`
- `RSAKeyParameters`
- `SymmetricKeyParameters`
- `WalnutDSAKeyParameters`
- `deriveEcYValue`
- `fromJwk`
- `isEcYValueEven`
- `toJwk`

## Development

Run from the repository root:

```bash
yarn workspace @verii/cose-key test
yarn workspace @verii/cose-key lint
```

