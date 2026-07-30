# Disclosure Type Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept string or string-array `type` values when serializing disclosed W3C presentations and credentials, while keeping credential issuance array-only.

**Architecture:** Add a presentation-scoped VC response schema derived from the strict shared VC schema and override only its `type` property. Point presentation response schemas at the tolerant schema and verify both scalar boundaries through one public endpoint integration test.

**Tech Stack:** Node.js, Fastify JSON schemas, `fast-json-stringify`, Node test runner, ESLint

## Global Constraints

- Keep `packages/common-schemas/src/issuing/w3c-vc.schema.json` unchanged.
- Keep `/operator/credentials/create` and `/operator/credentials/create-many` array-only.
- Preserve disclosed scalar values rather than normalizing them.
- Add one new integration test; rely on the existing array-path test for array coverage.
- Run `eslint --fix` on every modified JavaScript file.

---

### Task 1: Accept scalar disclosure types

**Files:**
- Create: `servers/credentialinghub/src/controllers/operator/presentations/schemas/disclosed-w3c-vc.schema.js`
- Modify: `servers/credentialinghub/src/controllers/operator/presentations/schemas/index.js`
- Modify: `servers/credentialinghub/src/controllers/operator/presentations/schemas/w3c-presentation.js`
- Modify: `servers/credentialinghub/src/controllers/operator/presentations/schemas/credential-verification.schema.js`
- Modify: `servers/credentialinghub/src/controllers/operator/presentations/presentations-controller.js`
- Test: `servers/credentialinghub/test/operator/presentations-controller.test.js`

**Interfaces:**
- Consumes: `w3cVcSchema` from `@verii/common-schemas`.
- Produces: `disclosedTypeSchema`, a schema fragment accepting a string or non-empty string array.
- Produces: `disclosedW3cVcSchema` with `$id: 'disclosed-w3c-vc'`.
- Preserves: the existing strict shared schema and credential creation contract.

- [ ] **Step 1: Write the failing endpoint integration test**

Add one test inside `verify a passed in jwtVp` that signs an OpenBadge credential with `type: 'OpenBadgeCredential'`, wraps it in a presentation with `type: 'VerifiablePresentation'`, calls `POST /operator/presentations/verify`, and asserts:

```js
expect(response.statusCode).toEqual(200);
expect(response.json.w3cPresentation.type).toEqual(
  'VerifiablePresentation',
);
expect(
  response.json.verification.credentials[0].w3cCredential.type,
).toEqual('OpenBadgeCredential');
```

- [ ] **Step 2: Run the new test to verify the serializer rejects scalars**

Run:

```bash
pnpm exec cross-env NODE_ENV=test node --test --test-concurrency=1 \
  --experimental-test-module-mocks \
  --test-name-pattern='scalar disclosure types' \
  --test-reporter=spec \
  test/operator/presentations-controller.test.js
```

Expected: FAIL because the response serializer rejects the scalar
`w3cPresentation.type`.

- [ ] **Step 3: Add the presentation-scoped tolerant VC schema**

Create `disclosed-w3c-vc.schema.js` with:

```js
const { w3cVcSchema } = require('@verii/common-schemas');

const disclosedTypeSchema = {
  oneOf: [
    {
      type: 'string',
    },
    {
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 1,
    },
  ],
};

const disclosedW3cVcSchema = {
  ...w3cVcSchema,
  $id: 'disclosed-w3c-vc',
  properties: {
    ...w3cVcSchema.properties,
    type: {
      ...disclosedTypeSchema,
      description: w3cVcSchema.properties.type.description,
    },
  },
};

module.exports = {
  disclosedTypeSchema,
  disclosedW3cVcSchema,
};
```

Export the new module from `schemas/index.js`.

- [ ] **Step 4: Use the tolerant schemas only for disclosure responses**

In `w3c-presentation.js`, use `disclosedTypeSchema` for the presentation
`type` property and change the embedded object credential reference to:

```js
{
  $ref: 'disclosed-w3c-vc#',
}
```

In `credential-verification.schema.js`, change `w3cCredential` to:

```js
w3cCredential: {
  $ref: 'disclosed-w3c-vc#',
},
```

In `presentations-controller.js`, replace the shared `w3cVcSchema`
registration with `disclosedW3cVcSchema` imported from `./schemas`.

- [ ] **Step 5: Format the affected JavaScript files**

Run:

```bash
pnpm exec eslint --fix \
  servers/credentialinghub/src/controllers/operator/presentations/schemas/disclosed-w3c-vc.schema.js \
  servers/credentialinghub/src/controllers/operator/presentations/schemas/index.js \
  servers/credentialinghub/src/controllers/operator/presentations/schemas/w3c-presentation.js \
  servers/credentialinghub/src/controllers/operator/presentations/schemas/credential-verification.schema.js \
  servers/credentialinghub/src/controllers/operator/presentations/presentations-controller.js \
  servers/credentialinghub/test/operator/presentations-controller.test.js
```

- [ ] **Step 6: Run the focused presentation-controller test file**

Run:

```bash
pnpm exec cross-env NODE_ENV=test node --test --test-concurrency=1 \
  --experimental-test-module-mocks \
  --test-reporter=spec \
  test/operator/presentations-controller.test.js
```

Expected: all presentation-controller tests pass, including the new scalar
case and the existing array case.

- [ ] **Step 7: Commit the implementation**

```bash
git add \
  docs/superpowers/plans/2026-07-30-disclosure-type-compatibility.md \
  servers/credentialinghub/src/controllers/operator/presentations \
  servers/credentialinghub/test/operator/presentations-controller.test.js
git commit --signoff -m "fix(credentialinghub): accept scalar disclosure types"
```
