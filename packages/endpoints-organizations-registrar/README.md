# Introduction
The package contains the minimum starting point, 
of what defines a package for us.

## Settings that differ between deployments

| Variable | What it does | Default when unset |
| --- | --- | --- |
| `NETWORK` | The Velocity network the registrar runs on: `devnet`, `testnet` or `mainnet`. Emails name it `DevNet`, `TestNet` or `MainNet`, and show any other value as it is. Invitation, "organization created" and signatory reminder subjects start with `DevNet: ` or `TestNet: ` on those networks. | None: the registrar requires it |
| `ENVIRONMENT_LABEL` | Names the deployment. Monitor names and the subjects of the "activation required" and "invitation accepted" emails start with it in capitals. Sentry events carry it as their environment. | `NETWORK`, then the value of `NODE_ENV` |
| `REGISTRAR_VALIDATE_KYB_PROFILE` | Validates a new organization's profile against the KYB schema. The `x-validate-kyb-profile: 1` header turns it on for one request. | `true` under `NODE_ENV=production`, otherwise `false` |
| `REGISTRAR_AUTO_ACTIVATE_SERVICES` | Activates an organization's services as it adds them. The `x-auto-activate: 0` header turns it off for one request. | `false` under `NODE_ENV=production`, otherwise `true` |

The last two used to follow `NODE_ENV`. When one is unset, it keeps the
behaviour `NODE_ENV` gave it, so under `NODE_ENV=production` it behaves as in
production.
