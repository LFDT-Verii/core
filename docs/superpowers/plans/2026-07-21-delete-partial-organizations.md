# Delete Partially Created Organizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow operators to soft-delete partially created organizations that lack `activatedServiceIds`, and guarantee the soft delete is persisted before the API returns `204`.

**Architecture:** Keep the behavior in the existing organization DELETE controller. Exercise the public HTTP endpoint with the existing Mongo-backed integration suite, reproducing the interrupted-registration document shape through a direct database update before making the minimal controller change.

**Tech Stack:** Node.js test runner, Fastify injection, MongoDB, lodash/fp, pnpm workspace

## Global Constraints

- Preserve the existing group cleanup and soft-delete behavior.
- Missing, `null`, and empty `activatedServiceIds` allow deletion; a non-empty array continues to return `400` with `deletion_forbidden`.
- Do not change API schemas, persistence schemas, migrations, registration behavior, authorization, or group deletion semantics.
- Run `eslint --fix` on every modified `.js` file.
- Use `corepack $(node -p "require('./package.json').packageManager")` for dependency commands.

---

### Task 1: Soft-delete interrupted registrations

**Files:**
- Modify: `packages/endpoints-organizations-registrar/test/organization-controller.test.js`
- Modify: `packages/endpoints-organizations-registrar/src/controllers/organizations/_did/controller.js`

**Interfaces:**
- Consumes: `DELETE /api/v0.6/organizations/:did`, `mongoDb().collection('organizations')`, the existing `persistOrganization`, `persistGroup`, `getOrganizationFromDb`, and `testRegistrarSuperUser` test helpers.
- Produces: DELETE behavior that treats an empty-like `activatedServiceIds` value as deletable and does not return until `repos.organizations.update(id, profile)` resolves.

- [x] **Step 1: Write the failing integration test**

Add this case to the existing `Organization Soft Delete` suite after the activated-services rejection case:

```js
it('Should soft delete a partially created organization', async () => {
  const organization = await persistOrganization();
  await persistGroup({ groupId: organization.didDoc.id });
  await mongoDb()
    .collection('organizations')
    .updateOne(
      { 'didDoc.id': organization.didDoc.id },
      { $unset: { activatedServiceIds: '' } },
    );

  const response = await fastify.injectJson({
    method: 'DELETE',
    url: `${baseUrl}/${organization.didDoc.id}`,
    headers: {
      'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
    },
  });

  expect(response.statusCode).toEqual(204);
  const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
  expect(orgFromDb.deletedAt).toEqual(expect.any(Date));
});
```

- [x] **Step 2: Run the integration test file to verify the regression fails**

Run:

```bash
NODE_ENV=test corepack $(node -p "require('./package.json').packageManager") exec node --test --test-concurrency=1 --test-timeout=900000 --experimental-test-module-mocks --test-name-pattern='Organization Soft Delete' --test-reporter=spec packages/endpoints-organizations-registrar/test/organization-controller.test.js
```

Expected: the new test fails because the DELETE request returns `500` when the controller reads `.length` from the missing `activatedServiceIds` property.

- [x] **Step 3: Implement the minimal controller fix**

Replace the activated-services guard and await the existing organization update:

```js
if (!isEmpty(orgToDelete.activatedServiceIds)) {
  throw newError(400, 'Cant delete. First remove activated services', {
    errorCode: 'deletion_forbidden',
  });
}
```

```js
const modifiedProfile = { ...orgToDelete, deletedAt: new Date() };
await repos.organizations.update(orgToDelete._id, modifiedProfile);
```

- [x] **Step 4: Format and lint the modified JavaScript files**

Run:

```bash
corepack $(node -p "require('./package.json').packageManager") exec eslint --fix packages/endpoints-organizations-registrar/test/organization-controller.test.js packages/endpoints-organizations-registrar/src/controllers/organizations/_did/controller.js
```

Expected: exit code `0` with no lint errors.

- [x] **Step 5: Run the focused soft-delete suite**

Run:

```bash
NODE_ENV=test corepack $(node -p "require('./package.json').packageManager") exec node --test --test-concurrency=1 --test-timeout=900000 --experimental-test-module-mocks --test-name-pattern='Organization Soft Delete' --test-reporter=spec packages/endpoints-organizations-registrar/test/organization-controller.test.js
```

Expected: all five soft-delete tests pass, including rejection for activated services and deletion for complete and partial organizations.

- [x] **Step 6: Run the full organization controller integration file**

Run:

```bash
NODE_ENV=test corepack $(node -p "require('./package.json').packageManager") exec node --test --test-concurrency=1 --test-timeout=900000 --experimental-test-module-mocks --test-reporter=spec packages/endpoints-organizations-registrar/test/organization-controller.test.js
```

Expected: all 71 tests pass with zero failures.

- [x] **Step 7: Commit the implementation**

```bash
git add docs/superpowers/plans/2026-07-21-delete-partial-organizations.md packages/endpoints-organizations-registrar/test/organization-controller.test.js packages/endpoints-organizations-registrar/src/controllers/organizations/_did/controller.js
git commit -m "fix: delete partially created organizations"
```
