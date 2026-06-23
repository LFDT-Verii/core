# Dependency Overrides

This repository keeps pnpm overrides narrow and temporary. Update this file whenever an override changes.

| Override | Why it exists | Remove when |
| --- | --- | --- |
| `mocha>serialize-javascript` -> `7.0.5` | Hardhat still resolves `serialize-javascript 6.x` through `mocha`, which keeps the vulnerable major branch alive. | The Hardhat/mocha path no longer resolves `serialize-javascript 6.x`. |
| `auth0>uuid` -> `^14.0.0` | `auth0` still resolves `uuid 9.x` through its `auth0-legacy` dependency path. | `auth0` stops resolving `uuid 9.x` through `auth0-legacy`. |
| `eslint-plugin-better-mutation>lodash` -> `^4.18.0` | `eslint-plugin-better-mutation` still pins `lodash 4.17.x`, so the workspace needs a newer lodash on that path. | The plugin loosens its lodash range. |
| `jsdom>undici` -> `7.28.0` | `jsdom@29.1.1` resolves `undici@7.25.0`, which is below the patched `7.28.0` release. | `jsdom` publishes a release that depends on patched `undici`. |

Keep the root `package.json` comments in sync with this table so the rationale stays close to the override definition and easy to audit during dependency updates.
