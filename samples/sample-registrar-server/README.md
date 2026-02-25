## Data Migrations
### Local
It is possible to run migration commands from the package's root folder:
- `pnpm run migrate:create migration-name-kebab-case-format` Will create a file in `migrations` folder
- `pnpm run migrate:up`: Will run all migrations
- `pnpm run migrate:down`: Will revert the last executed migration
- `pnpm run migrate:status`: Will show the current migration status

#### Environment variables for migrations
* Use `MIGRATION_ENV=[standalone|localdev|...]` to pull in the correct config
