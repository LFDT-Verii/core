# Shared Swagger Velocity Branding Design

## Summary

Replace the default Fastify branding in every Swagger UI created by
`@verii/server-provider` with Velocity branding:

- the supplied white Velocity wordmark in the Swagger top bar; and
- the favicon currently used by the Velocity Network Foundation website.

Both images are packaged with the shared server library. Swagger UI does not
fetch branding assets from an external website at runtime.

## Goals

- Display the supplied Velocity wordmark in the top bar of every shared
  Swagger UI.
- Display the official Velocity Network Foundation favicon in the browser tab.
- Apply the branding globally without adding per-service configuration.
- Keep the assets available when `@verii/server-provider` is published.
- Verify the generated UI through public documentation endpoints.

## Non-goals

- Changing OpenAPI titles, descriptions, tags, or document selectors.
- Changing the Swagger UI color palette or layout.
- Changing the logo link destination or adding a new external link.
- Adding per-service logo or favicon overrides.
- Fetching or refreshing branding assets at runtime.

## Assets

Store both PNG files under `packages/server/src/assets/`:

| Asset | Source | Properties |
| --- | --- | --- |
| `velocity-logo.png` | User-supplied image | 747 by 166 pixels, transparent background, white Velocity wordmark |
| `velocity-favicon.png` | [Velocity Network Foundation favicon](https://www.velocitynetwork.foundation/wp-content/uploads/2020/01/VNF-favicon-blc-150x150.png) | 150 by 150 pixels, transparent background, black Velocity mark |

Preserve the supplied and downloaded bytes without resizing or re-encoding.
The package's current `.npmignore` rules include files under `src`, so both
assets are included in the published package.

## Shared server integration

`packages/server/src/common-create-server.js` loads the two packaged files as
buffers relative to its own `__dirname`. The existing Swagger UI registration
passes:

```js
logo: {
  type: 'image/png',
  content: velocityLogo,
},
theme: {
  favicon: [
    {
      filename: 'velocity-favicon.png',
      rel: 'icon',
      sizes: '32x32',
      type: 'image/png',
      content: velocityFavicon,
    },
  ],
},
```

`@fastify/swagger-ui` embeds the logo as a data URL in
`/documentation/static/swagger-initializer.js` and serves the favicon at
`/documentation/static/theme/velocity-favicon.png`. Its generated
`/documentation/` HTML references that favicon route.

This configuration belongs to the shared registration, so it applies to both
single-document and multiple-document Swagger UIs in every service using
`@verii/server-provider`. Existing Swagger generator registration, named
documents, OAuth initialization, and selector configuration remain unchanged.

## Error behavior

The assets are required package files. A missing or unreadable asset fails
server initialization instead of silently falling back to Fastify branding.
No new request-time failure path is introduced because both buffers are loaded
locally and supplied to Swagger UI during registration.

## Testing and verification

Extend the shared server integration tests through public documentation
endpoints:

- `GET /documentation/static/swagger-initializer.js` contains an
  `image/png` data URL whose Base64 content exactly matches
  `velocity-logo.png`.
- `GET /documentation/` references
  `/documentation/static/theme/velocity-favicon.png`.
- `GET /documentation/static/theme/velocity-favicon.png` returns `200`,
  `image/png`, and bytes exactly matching `velocity-favicon.png`.
- Existing single-document and named-document Swagger UI assertions continue
  to pass.

Run ESLint with `--fix` on every changed JavaScript file and run the complete
`@verii/server-provider` test suite. Inspect the package contents to confirm
both PNG assets are publishable. Finally, use the running CIH Docker Compose
service to verify visually that the top bar displays the Velocity wordmark and
the browser tab uses the Velocity favicon.
