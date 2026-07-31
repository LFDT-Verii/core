## Changes

### [#770](https://github.com/LFDT-Verii/core/pull/770) Revoke issued credentials

Operators can revoke credentials through `POST /operator/credentials/revoke`. Credentialing Hub records the revocation, updates the on-chain registry, and notifies the wallet about revocation or replacement when exchange messaging settings are available.

### [#775](https://github.com/LFDT-Verii/core/pull/775) Deliver signed notification webhooks

Credential issuance and presentation flows can enqueue Mongo-backed webhook events for `presentation.received`, `credential.issued`, and `credential.rejected`. Delivery, retry, lease recovery, wildcard subscriptions, and HMAC signing are completed by [#814](https://github.com/LFDT-Verii/core/pull/814).

### [#831](https://github.com/LFDT-Verii/core/pull/831) Inspect exchanges safely

Authenticated operators can retrieve a tenant-scoped, sanitized exchange projection for status polling and downstream verification workflows. Persisted internal failures are mapped to safe public errors.

### [#840](https://github.com/LFDT-Verii/core/pull/840) Publish API documentation by audience

Swagger UI now separates Operator, OpenID4VC Wallet, and VN-API Wallet documents, with isolated schemas and security definitions for each audience. Existing Operator and OpenID4VC document URLs remain available, and VN-API documentation is exposed at `/documentation/vn-api.json`.

### [#870](https://github.com/LFDT-Verii/core/pull/870) Support pluggable CAO operator authentication

Deployments can inject a CAO security provider for Operator authentication, request-aware blockchain credentials, and Swagger metadata. Tenant operations are isolated by the authenticated principal's CAO through [#871](https://github.com/LFDT-Verii/core/pull/871), including resource concealment across CAO boundaries.

### [#874](https://github.com/LFDT-Verii/core/pull/874) Create depots for relying-party services

Operator depot creation now supports active relying-party services as well as issuer services, enabling presentation polling flows to use an RP-owned depot as their correlation key.

### [#875](https://github.com/LFDT-Verii/core/pull/875) Link disclosed presentations to their exchange

VN-API presentation submissions now persist the canonical exchange identifier, so operator exchange inspection returns the resulting presentation IDs instead of leaving downstream polling stuck.

### [#878](https://github.com/LFDT-Verii/core/pull/878) Accept scalar W3C disclosure types

Presentation verification responses now preserve and serialize both string and string-array `type` values for disclosed presentations and credentials. Credential issuance remains array-only.

## Backward incompatibilities

- The built-in Operator authentication provider now requires `DEFAULT_CAO_DID`.
- Operator tenant creation derives `caoDid` from the authenticated principal and rejects caller-supplied `caoDid` values.
- Custom `caoSecurityProvider` implementations must supply a non-empty string `caoDid` on the authenticated Operator principal; all Operator tenant access is scoped to that CAO.
