## Data Migrations
### Local
Where implemented, such as in the credential agent and oracle,
it is possible to run migration commands from the package's root folder:
- `pnpm run migrate:create migration-name-kebab-case-format` Will create a file in `migrations` folder
- `pnpm run migrate:up`: Will run all migrations
- `pnpm run migrate:down`: Will revert the last executed migration
- `pnpm run migrate:status`: Will show the current migration status


#### Notes for credential-agent migrations
* The MongoDB database URI should be set in the `MONGO_URI` environment variable in order for the commands to execute.

### Docker Images

It is also possible to run the migrations using the services' docker images (services that include migrations):
```
docker run --name credentialagent-migrations -e MONGO_URI=****  ghcr.io/velocitynetworkfoundation/credentialagent:latest sh -c "cd servers/credentialagent && pnpm run migrate:up"
```

## Settings that differ between deployments

This setting used to follow `NODE_ENV`. When it's unset, it keeps the
behaviour `NODE_ENV` gave it, so under `NODE_ENV=production` it behaves as in
production.

| Variable | What it does | Default when unset |
| --- | --- | --- |
| `ENABLE_UNSIGNED_JSON_FORMAT` | Lets holders fetch presentation and issuing requests as unsigned JSON, with `?format=json`, instead of as a signed JWT. It's for development and testing. | `false` under `NODE_ENV=production`, otherwise `true` |

`ENVIRONMENT_LABEL` names the deployment, and Sentry events carry it as their
environment. It defaults to the value of `NODE_ENV`.
