# Task 2: CIH document configuration and audience filtering

## Scope delivered

- Replaced the CIH Swagger smoke test with public-endpoint tests for the
  Operator, OpenID4VC Wallet, and VN-API Wallet documents.
- Added `createSwaggerConfig(version)`, including the three document titles,
  descriptions, ordered tag declarations, version sourced from CIH
  `package.json`, and one relevant security-scheme definition per document.
- Configured the default operator generator plus named OpenID4VC and VN-API
  generators through Task 1's `swaggerOptions` and `swaggerDocuments`
  interfaces.
- Added fail-closed audience transforms and scoped audience assignment for the
  operator, OpenID4VC, OpenID4VP, and VN-API controller trees.
- Classified the health route as `operator` and app redirect as `hidden`.

## RED evidence

After replacing the smoke test, this command failed as required:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-credentialing-hub exec cross-env NODE_ENV=test node --test --test-concurrency=1 --experimental-test-module-mocks --test-reporter=spec test/swagger.test.js
```

The test received `404` for both new public endpoints:

- `GET /documentation/openid4vc.json`
- `GET /documentation/vn-api.json`

This verified that the new named-document integration test was exercising the
missing feature before production changes.

## Implementation and debugging note

The first implementation run found Fastify Swagger resolving the existing
operator `bearerAuth` operation schema against the new document's
`operatorBearer` scheme. This produced a 500 while generating
`/documentation/json`. The controller-scope preset was therefore aligned to
`operatorBearer`, the scheme defined by this document configuration.

Route tracing then showed that OpenID metadata's CORS plugin registers a
`schema.hide: true` wildcard `OPTIONS` route. The mandated audience transform
sets `hide` from the audience, so the audience helper preserves explicitly
hidden routes instead of reclassifying them. Metadata routes without schemas
remain classified and are documented; CORS infrastructure remains
unclassified and is hidden by the transform.

## GREEN evidence

Ran the focused integration test again after the implementation:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-credentialing-hub exec cross-env NODE_ENV=test node --test --test-concurrency=1 --experimental-test-module-mocks --test-reporter=spec test/swagger.test.js
```

Result: 2 tests passed, 0 failed.

Also ran ESLint auto-fix on every changed JavaScript file:

```bash
PATH=/usr/local/bin:$PATH corepack $(PATH=/usr/local/bin:$PATH node -p "require('./package.json').packageManager") --filter @verii/server-credentialing-hub exec eslint --fix src/config/config.js src/config/swagger-config.js src/documentation/set-documentation-audience.js src/controllers/operator/autohooks.js src/controllers/openid4vc/autohooks.js src/controllers/openid4vp/autohooks.js src/controllers/vn-api/autohooks.js src/controllers/root-controller.js src/controllers/app-redirect/controller.js test/swagger.test.js
```

## Files changed

- `servers/credentialinghub/src/config/config.js`
- `servers/credentialinghub/src/config/swagger-config.js`
- `servers/credentialinghub/src/documentation/set-documentation-audience.js`
- `servers/credentialinghub/src/controllers/operator/autohooks.js`
- `servers/credentialinghub/src/controllers/openid4vc/autohooks.js`
- `servers/credentialinghub/src/controllers/openid4vp/autohooks.js`
- `servers/credentialinghub/src/controllers/vn-api/autohooks.js`
- `servers/credentialinghub/src/controllers/root-controller.js`
- `servers/credentialinghub/src/controllers/app-redirect/controller.js`
- `servers/credentialinghub/test/swagger.test.js`

## Self-review

- Verified all three titles use `Velocity Credentialing Hub`, never Agent.
- Verified all document versions receive the CIH package version argument.
- Verified tag ordering, exact public operation sets, no overlap, no app
  redirect, and no documentation routes through public endpoints.
- Verified named Swagger UI URLs and `Operator API` primary selection.
- Verified each document has only its relevant scheme key:
  `operatorBearer`, `openid4vcAccessToken`, or `vnApiAccessToken`.
- Verified the audience helper remains outside the autoloaded controllers tree
  and does not alter route handlers.
- Ran `git diff --check`; no whitespace errors were found.

## Deferred to Task 3

Visible per-operation tags, summaries, operation IDs, and wallet security
requirements remain intentionally deferred. The operator preset scheme rename
is retained because the document-level `operatorBearer` definition must match
the pre-existing generated operator security requirement for Swagger to
generate the document.
