# metrics command

Used for getting metrics by issued credentials

### Steps

1. Execute the command

## How to Use

`agentdb-cli metrics [options]`

### Options

`-u [MONGO_URI]` **required** The url of the mongo database for credential agent
`-s [Start Date]` **required** The start date for filter (timestamp)
`-e [End Date]` **required** The end date for filter (timestamp)
`-d [DID]` A did of an issuing organization to filter offers by

### Examples

```

Executing

```
./agentdb-cli metrics -u mongodb://localhost:27017/test-credential-agent -d did:ion:foo -s 2020-05-20T00:00:00.000Z -e 2025-05-20T00:00:00.000Z
```