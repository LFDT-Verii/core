# Introduction
The package contains the minimum starting point, 
of what defines a package for us.

## Settings that differ between deployments

These settings used to follow `NODE_ENV`. Set them for each deployment. When
one is unset, it keeps the behaviour `NODE_ENV` gave it, so under
`NODE_ENV=production` it behaves as in production.

| Variable | What it does | Default when unset |
| --- | --- | --- |
| `ENVIRONMENT_LABEL` | Names the deployment. Monitor names and the subjects of the "activation required" and "invitation accepted" emails start with it in capitals. Sentry events carry it as their environment. | The value of `NODE_ENV` |
| `REGISTRAR_NETWORK_NAME` | The network's name in emails, as in "Velocity Services Activated on DevNet". | From `NODE_ENV`: `LocalDevNet` for `development` and `test`, `DevNet` for `dev`, `TestNet` for `staging`, `MainNet` for `production`, otherwise empty |
| `REGISTRAR_NETWORK_NAME_IN_EMAIL_SUBJECTS` | Starts the subjects of invitation, "organization created" and signatory reminder emails with `<network name>: `. | `false` under `NODE_ENV=production`, otherwise `true` |
| `REGISTRAR_VALIDATE_KYB_PROFILE` | Validates a new organization's profile against the KYB schema. The `x-validate-kyb-profile: 1` header turns it on for one request. | `true` under `NODE_ENV=production`, otherwise `false` |
| `REGISTRAR_AUTO_ACTIVATE_SERVICES` | Activates an organization's services as it adds them. The `x-auto-activate: 0` header turns it off for one request. | `false` under `NODE_ENV=production`, otherwise `true` |
