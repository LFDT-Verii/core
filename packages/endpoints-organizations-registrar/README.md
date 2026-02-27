# @verii/endpoints-organizations-registrar

Organization Registrar

## Installation

```bash
yarn add @verii/endpoints-organizations-registrar
```

## Usage

```js
const { AuthClientTypes, Authorities, ConsentTypes } = require('@verii/endpoints-organizations-registrar');

// Use the exported members for your workflow.
```

## Entry Point

- `src/index.js`

## Top-level Exports

- `AuthClientTypes`
- `Authorities`
- `ConsentTypes`
- `GroupErrorMessages`
- `ImageState`
- `KeyErrorMessages`
- `NodeServiceCategories`
- `OrganizationErrorMessages`
- `OrganizationServiceErrorMessages`
- `OrganizationTypes`
- `PublicProfileFieldsForHide`
- `RegistrarScopes`
- `RoleNames`
- `ServiceTypeLabels`
- `SignatoryEventStatus`
- `UserErrorMessages`
- `VNF_GROUP_ID_CLAIM`
- `acceptInvitation`
- `activateServices`
- `addInvitationBodySchema`
- ... and 123 more (see `src/index.js`)

## Development

Run from the repository root:

```bash
yarn workspace @verii/endpoints-organizations-registrar test
yarn workspace @verii/endpoints-organizations-registrar lint
```

