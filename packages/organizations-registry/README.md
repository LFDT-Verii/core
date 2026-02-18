# @verii/organizations-registry

Velocity DID documents library

## Installation

```bash
yarn add @verii/organizations-registry
```

## Usage

```js
const { IonPublicKeyPurpose, IssuingAndInspectionCategories, OrganizationRegistryErrorMessages } = require('@verii/organizations-registry');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `IonPublicKeyPurpose`
- `IssuingAndInspectionCategories`
- `OrganizationRegistryErrorMessages`
- `ServiceCategories`
- `ServiceTypeToCategoryMap`
- `ServiceTypes`
- `ServiceTypesOfServiceCategory`
- `categorizeServices`

## Development

Run from the repository root:

```bash
yarn workspace @verii/organizations-registry test
yarn workspace @verii/organizations-registry lint
```

