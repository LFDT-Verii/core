# Organization Registrar React Components
This package contains the main components for creating a registry of organizations. The project is written in pure JS.

## Builds
Vite is used for building the project - primarily involving transpilation of JSX files using SWC

## Tests
Tests are written in Jest

## Style
Style is maintained in eslint based on the monorepo root styles

## How to develop
`> vite build:watch`

## Auth contract
Host applications provide authentication through `AuthContext`. The component
library expects the host to provide the current auth state, token retrieval, and
login/logout functions.

`PrivateAppRoot` also reads `auth.isLogoutInProgress`. When this value is true,
`PrivateAppRoot` enters its internal `resolvingLogout` state, renders the
loading screen, and does not trigger the automatic login redirect. This prevents
an explicit logout from racing against login and re-authenticating the user from
an existing identity-provider session.

Host apps should set `isLogoutInProgress` synchronously before starting provider
logout. If omitted, it is treated as false.

## See how to use it
[Sample Registrar App](../../samples/sample-registrar-app)
