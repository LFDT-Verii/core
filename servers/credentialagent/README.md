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

`ENVIRONMENT_LABEL` names the deployment, and Sentry events carry it as their
environment. It defaults to `NETWORK`, the network the deployment runs on, and
then to the value of `NODE_ENV`.

The holder endpoints that return presentation and issuing requests return them
as unsigned JSON, instead of as a signed JWT, when called with `?format=json`.
They do that in every environment.
