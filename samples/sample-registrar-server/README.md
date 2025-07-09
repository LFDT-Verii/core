## Data Migrations
### Local
It is possible to run migration commands from the package's root folder:
- `yarn migrate:create migration-name-kebab-case-format` Will create a file in `migrations` folder
- `yarn migrate:up`: Will run all migrations
- `yarn migrate:down`: Will revert the last executed migration
- `yarn migrate:status`: Will show the current migration status

#### Environment variables for migrations
* Use `MIGRATION_ENV=[standalone|localdev|...]` to pull in the correct config
