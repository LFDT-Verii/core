# CIH Swagger Cleanup Design

## Summary

Replace the Credentialing Hub's single mixed OpenAPI document with an
operator-first Swagger UI selector backed by three independently generated
OpenAPI documents:

1. Operator API
2. OpenID4VC Wallet API
3. VN-API Wallet API

The operator document is the default because its audience is CIH integrators.
Wallet-facing protocols remain available as separate references without being
mixed into the operator surface. This is a documentation-only change: request
routing and runtime authentication behavior do not change.

## Goals

- Make `/documentation` open the operator API by default.
- Separate operator, OpenID4VC, and VN-API operations into distinct OpenAPI
  documents selectable from one Swagger UI.
- Group operator operations by entity.
- Group OpenID4VC operations into OpenID4VCI and OpenID4VP, with issuer
  metadata and OAuth token operations folded into OpenID4VCI.
- Group VN-API operations into Issuing and Presentation.
- Describe each document's actual authentication requirements accurately.
- Replace the stale `Credential Agent v2` metadata with CIH-specific titles
  and the current CIH package version.
- Preserve the existing single-document behavior for other Verii servers.

## Non-goals

- Changing endpoint paths, handlers, or runtime authentication.
- Redesigning the OpenID4VC or VN-API protocols.
- Rewriting every request and response schema.
- Hosting three independent copies of Swagger UI.
- Introducing nested tag groups unsupported by Swagger UI.

## Approaches considered

### Multiple Swagger generators (selected)

Register `@fastify/swagger` once per document, using its `decorator` and
`transform` options to build independently filtered specifications. Configure
Swagger UI with multiple document URLs through `uiConfig.urls` and make the
operator document primary through `urls.primaryName`.

This is the plugin's supported multiple-document mechanism. It keeps titles,
tags, paths, components, and security schemes isolated by audience.

### One generator with filtered copies

Generate one complete specification and remove paths before serving each copy.
Although this needs fewer Swagger registrations, it requires additional logic
to prune unused tags, schemas, and security schemes. It is more likely to leave
irrelevant or dangling components in a filtered document.

### One document with tags

Use flat tags such as `Operator - Credentials` and `OpenID4VCI`. This is the
simplest change but does not separate audiences, and it presents unrelated
authentication schemes together. It does not meet the primary goal.

## Architecture

### Reusable server support

Extend the shared server documentation setup to accept optional
multiple-document configuration. When that configuration is absent, retain the
current single Swagger generator, `/documentation/json`,
`/documentation/yaml`, and Swagger UI behavior.

For CIH, server startup performs these steps before registering application
routes:

1. Register the default operator Swagger generator.
2. Register named OpenID4VC and VN-API Swagger generators.
3. Register the named documents' hidden JSON endpoints.
4. Register Swagger UI with the three document URLs and the operator document
   as the primary selection.
5. Register the CIH controller routes.

The default generator continues to serve `/documentation/json`, preserving the
existing machine-readable documentation URL. The selector uses:

| Selector name | Document URL |
| --- | --- |
| Operator API | `/documentation/json` |
| OpenID4VC Wallet API | `/documentation/openid4vc.json` |
| VN-API Wallet API | `/documentation/vn-api.json` |

The new document-serving routes are hidden from every generated specification.

### Route audience classification

Every CIH operation has exactly one internal documentation audience:

- `operator`
- `openid4vc`
- `vn-api`
- `hidden`

Apply the classification through Fastify's encapsulated controller scopes so
individual route schemas do not repeat audience tags. The operator, OpenID4VC,
OpenID4VP, and VN-API controller subtrees assign their respective audience.
The root health route belongs to the operator document under Utilities. The app
redirect and documentation infrastructure routes are hidden.

Audience is internal Fastify route metadata, not a visible OpenAPI tag. Each
Swagger transform clones the route schema and hides operations whose audience
does not match its document. A route with no audience is hidden from all three
documents. This fail-closed behavior prevents a new wallet-facing route from
appearing accidentally in the operator document.

Transforms must not mutate shared route schemas because all three generators
observe the same registered routes.

### Visible grouping metadata

Controller-level schema presets apply the visible OpenAPI tag for each entity
or protocol group. Every documented operation also receives:

- a concise action-oriented `summary`;
- a stable, unique `operationId` using verb-and-entity naming; and
- the appropriate operation-level `security` requirement.

Top-level tag declarations establish the desired display order and provide a
short description for each group.

## Documents

### Operator API

OpenAPI title: `Velocity Credentialing Hub — Operator API`

Tags, in order:

1. Tenants
2. Issuer Services
3. Relying Party Services
4. Depots
5. Credentials
6. Presentations
7. Issue Links
8. Presentation Links
9. Exchanges
10. Utilities

The document includes the root health operation and every route under the
operator controller subtree. It excludes all wallet protocol and infrastructure
routes.

### OpenID4VC Wallet API

OpenAPI title: `Velocity Credentialing Hub — OpenID4VC Wallet API`

Tags, in order:

1. OpenID4VCI
   - credential issuer metadata
   - authorization server metadata
   - token
   - nonce
   - credential
   - notification
2. OpenID4VP
   - authorization request
   - direct-post authorization response

The combined document title, selector label, and
`/documentation/openid4vc.json` URL retain the OpenID4VC umbrella name because
the document contains both OpenID4VCI and OpenID4VP operations. The internal
`openid4vc` audience and Swagger decorator also retain that umbrella name.
Issuance-specific tags, summaries, operation IDs, descriptions, and security
scheme names use OpenID4VCI.

Protocol-level requirements such as pre-authorized codes, proofs, wallet
metadata, nonces, and state remain request parameters or body fields rather
than being modelled as HTTP security schemes.

### VN-API Wallet API

OpenAPI title: `Velocity Credentialing Hub — VN-API Wallet API`

Tags, in order:

1. Issuing
   - credential manifest
   - authenticate
   - credential offers
   - issue credentials
2. Presentation
   - presentation request
   - presentation submission

### Route inventory

The initial partition uses the following path-and-method inventory. Future
routes must be added to one audience explicitly.

#### Operator

| Tag | Operations |
| --- | --- |
| Tenants | `POST /operator/tenants/create`, `GET /operator/tenants/get`, `POST /operator/tenants/delete` |
| Issuer Services | `POST /operator/issuer-services/create`, `GET /operator/issuer-services/get`, `POST /operator/issuer-services/update`, `POST /operator/issuer-services/delete` |
| Relying Party Services | `POST /operator/relying-party-services/create`, `GET /operator/relying-party-services/get`, `POST /operator/relying-party-services/update`, `POST /operator/relying-party-services/delete` |
| Depots | `POST /operator/depots/create`, `GET /operator/depots/get`, `POST /operator/depots/delete` |
| Credentials | `POST /operator/credentials/create`, `POST /operator/credentials/create-many`, `GET /operator/credentials/get`, `POST /operator/credentials/revoke`, `POST /operator/credentials/delete` |
| Presentations | `GET /operator/presentations/get`, `POST /operator/presentations/verify` |
| Issue Links | `POST /operator/issue-links/refresh` |
| Presentation Links | `POST /operator/presentation-links/refresh` |
| Exchanges | `GET /operator/exchanges/get` |
| Utilities | `GET /` |

Every operation in this table except `GET /` requires `operatorBearer`.

#### OpenID4VC

| Tag | Operation | HTTP security |
| --- | --- | --- |
| OpenID4VCI | `POST /r/{tenantId}/openid4vc/nonce` | None |
| OpenID4VCI | `POST /r/{tenantId}/openid4vc/credential` | `openid4vciAccessToken` |
| OpenID4VCI | `POST /r/{tenantId}/openid4vc/notification` | `openid4vciAccessToken` |
| OpenID4VP | `POST /r/{tenantId}/openid4vp/authorization-request/{requestId}` | None |
| OpenID4VP | `POST /r/{tenantId}/openid4vp/direct-post` | None |
| OpenID4VCI | `GET /.well-known/openid-credential-issuer/r/{tenantId}` | None |
| OpenID4VCI | `GET /.well-known/oauth-authorization-server/r/{tenantId}` | None |
| OpenID4VCI | `POST /r/{tenantId}/oauth/token` | None; protocol request carries the pre-authorized grant |

#### VN-API

| Tag | Operation | HTTP security |
| --- | --- | --- |
| Issuing | `GET /vn-api/r/{tenantId}/get-credential-manifest` | None |
| Issuing | `POST /vn-api/r/{tenantId}/authenticate` | None |
| Issuing | `POST /vn-api/r/{tenantId}/credential-offers` | `vnApiAccessToken` |
| Issuing | `POST /vn-api/r/{tenantId}/issue-credentials` | `vnApiAccessToken` |
| Presentation | `GET /vn-api/r/{tenantId}/get-presentation-request` | None |
| Presentation | `POST /vn-api/r/{tenantId}/presentation` | None |

`GET /app-redirect` and all documentation infrastructure routes use the
`hidden` audience.

## Authentication model

Use distinct security-scheme keys so Swagger UI never implies that tokens are
interchangeable.

| Scheme | Definition | Applied operations |
| --- | --- | --- |
| `operatorBearer` | HTTP bearer containing the opaque token configured by `OPERATOR_API_TOKEN`; no `bearerFormat: JWT` | All operator controller operations |
| `openid4vciAccessToken` | HTTP bearer JWT returned by the OpenID4VCI token endpoint | OpenID4VCI credential and notification |
| `vnApiAccessToken` | HTTP bearer JWT returned during a VN-API exchange | VN-API credential offers and issue credentials |

The operator health operation is unauthenticated. OpenID4VCI token, nonce, and
metadata operations and OpenID4VP operations have no HTTP bearer requirement.
VN-API manifest, authentication, presentation-request, and
presentation-submission operations also have no HTTP bearer requirement. Their
protocol payloads and exchange state continue to provide the checks already
implemented by the handlers.

Keep security requirements operation-level so the generated document mirrors
the actual protected routes. The existing operator schema preset remains the
source of the operator security requirement and its generated 401/403 response
references.

## Version and descriptive metadata

All three OpenAPI `info.version` values come from the CIH package version rather
than a duplicated hard-coded value. Remove the `Credential Agent v2` title and
replace its issuer/verifier description with audience-specific descriptions.

This cleanup adds the minimal schema metadata needed to classify and describe
currently sparse routes, including the well-known metadata operations. It does
not require completing unrelated response-schema gaps.

## Error and fallback behavior

- An unclassified route is omitted from all documents.
- A route is never included in more than one audience document.
- Document generation does not participate in application request handling, so
  a documentation classification cannot alter runtime authorization.
- Existing Fastify error schemas and generated validation responses remain in
  use.
- Existing servers without multiple-document configuration keep their current
  documentation endpoints and behavior.

## Testing

Because this change is documentation orchestration, verify it through the
public documentation endpoints.

### CIH integration tests

- `GET /documentation/json` returns the Operator API title and only operator
  operations.
- `GET /documentation/openid4vc.json` returns the OpenID4VC title and only
  OpenID4VC operations.
- `GET /documentation/vn-api.json` returns the VN-API title and only VN-API
  operations.
- The union of the three expected path-and-method sets contains every intended
  documented CIH operation, with no overlap.
- Each document declares its expected tags in order.
- Operator, OpenID4VC, and VN-API security requirements appear only on the
  operations that enforce them.
- The health operation is present only in the operator document and has no
  security requirement.
- Infrastructure and unclassified routes are absent from every document.
- Swagger UI's initializer contains the three selector URLs and selects the
  operator document by default.

### Shared server regression tests

- Existing single-document configuration still exposes
  `/documentation/json`, `/documentation/yaml`, and the UI.
- Named document endpoints call the configured Swagger decorators and remain
  hidden from generated specifications.

After JavaScript changes, run ESLint with `--fix` on every affected JavaScript
file, followed by the focused shared-server and CIH test suites.

## References

- [@fastify/swagger multiple documents and transforms](https://github.com/fastify/fastify-swagger)
- [Swagger UI multiple document configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)
- [OpenAPI operation tags and security requirements](https://spec.openapis.org/oas/v3.1.0.html)
