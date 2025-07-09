## Data Migrations
### Local
Where implemented, such as in the credential agent and oracle,
it is possible to run migration commands from the package's root folder:
- `yarn migrate:create migration-name-kebab-case-format` Will create a file in `migrations` folder
- `yarn migrate:up`: Will run all migrations
- `yarn migrate:down`: Will revert the last executed migration
- `yarn migrate:status`: Will show the current migration status


#### Notes for credential-agent migrations
* The MongoDB database URI should be set in the `MONGO_URI` environment variable in order for the commands to execute.

### Docker Images

It is also possible to run the migrations using the services' docker images (services that include migrations):
```
docker run --name credentialagent-migrations -e MONGO_URI=****  ghcr.io/velocitynetworkfoundation/credentialagent:latest sh -c "cd servers/credentialagent && yarn migrate:up"
```
