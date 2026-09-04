## Changes

### [#958](https://github.com/LFDT-Verii/core/pull/958) Recover automatically from failed organization registrations

Registrar now keys Fineract clients and accounts by the organization's Mongo ID instead of its DID, so long DIDs no longer exceed Fineract's 100-character external ID limit. When any provisioning step fails during registration (Fineract, Auth0, KMS, or blockchain), the organization is soft deleted and its group is cleaned up, so it is hidden from every retrieval endpoint and the customer can register again. Organizations left partial by earlier failures are still listed by `GET /organizations/full` with an empty `permittedVelocityServiceCategory`; a migration for those records is tracked in [#959](https://github.com/LFDT-Verii/core/issues/959).

## Backward incompatibilities

- `@verii/fineract-client` `createFineractClient` reads `_id` and `profile` from the organization argument instead of `didDoc` and `profile`, and throws when `_id` is missing.
- Fineract clients and accounts created for new organizations use `registrar:org:<mongoId>` external IDs. Existing organizations keep their DID-based external IDs; nothing in the platform reads Fineract by external ID.
