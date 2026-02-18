# @verii/test-regexes

Set of regexes for tests

## Installation

```bash
yarn add @verii/test-regexes
```

## Usage

```js
const { AUTH0_USER_ID_FORMAT, BASE64_FORMAT, DID_FORMAT } = require('@verii/test-regexes');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `AUTH0_USER_ID_FORMAT`
- `BASE64_FORMAT`
- `DID_FORMAT`
- `ETHEREUM_ADDRESS_FORMAT`
- `HEX_FORMAT`
- `ISO_DATETIME_FORMAT`
- `ISO_DATETIME_FORMAT_ONLY_DATE_SECTION`
- `JWT_FORMAT`
- `NANO_ID_FORMAT`
- `NUMERIC_FORMAT`
- `OBJECT_ID_FORMAT`
- `REQUEST_ID`
- `TW0_DECIMAL_POINT_NUMBER`
- `TW0_OR_THREE_DECIMAL_POINT_NUMBER`
- `URLSAFE_BASE64_FORMAT`
- `UUID_FORMAT`

## Development

Run from the repository root:

```bash
yarn workspace @verii/test-regexes test
yarn workspace @verii/test-regexes lint
```

