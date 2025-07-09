# migrate-tenant-did command

Used for migrating a tenant's did on the agent

### Steps

1. Locate the tenant whose did you want migrated
2. Execute the command to migrate a tenant's did to organization's latest did from the registrar

## How to Use

`@verii/vnf-agent-cli migrate-tenant-did [options]`

### Options

`-d, --did <did>` The did of tenant that should be migrated. Cannot be combined with --all flag (one of `--all` or `--did` is **required**)
`-a, --all` Runs did migration for all tenants on agent. Cannot be combined with --did flag (one of `--all` or `--did` is **required**)
`-e [URL]` **required** url of the target credential agent server
`-a [AUTH_TOKEN]` **required** bearer token to use when calling the credential agent server

### Examples

```
@verii/vnf-agent-cli  migrate-tenant-did -e "token" -d "did:foo:bar"
```