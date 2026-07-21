# Delete Partially Created Organizations

## Context

Organization creation persists the organization before provisioning its Fineract resources. If Fineract is unavailable, the resulting organization can lack `activatedServiceIds`. The organization deletion endpoint currently reads `.length` from that missing property and returns an internal server error, preventing operators from soft-deleting the partial organization so the customer can register again.

The deletion endpoint also returns `204` without awaiting the organization update, so the response does not guarantee that the soft delete has been persisted.

## Design

Keep the change within the existing organization deletion controller:

- Use the controller's existing `isEmpty` helper when checking `activatedServiceIds`. Missing, `null`, and empty arrays will be treated as having no activated services and can be deleted. Non-empty arrays will continue to return the existing `400` `deletion_forbidden` response.
- Await the repository update that writes `deletedAt` before returning `204`.
- Preserve the existing group cleanup and soft-delete behavior.

No API schema, persistence schema, migration, or registration behavior changes are required.

## Testing

Add an integration test to the existing `Organization Soft Delete` suite. The test will:

1. Persist an organization and group using the existing factories.
2. Remove `activatedServiceIds` directly from the stored organization to reproduce an interrupted registration.
3. Call `DELETE /api/v0.6/organizations/:did` as a registrar superuser.
4. Assert a `204` response.
5. Read the organization directly from the database and assert that `deletedAt` was persisted.

Existing tests continue to cover rejection when activated services are present and successful deletion for complete organizations.

## Non-goals

- Making organization creation transactional or resumable.
- Cleaning up Fineract, KMS, Auth0, or other external resources.
- Backfilling existing organization documents.
- Changing authorization or group deletion semantics.
