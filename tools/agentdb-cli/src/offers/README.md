# offers command

Used for mass-updating `offerExpirationDate` field on offers in a database

### Steps

1. Execute the command

## How to Use

`agentdb-cli offers [options]`

### Options

`-d, --did [DID]` A did of an issuing organization to filter offers by (can pass multiple times)

<!-- theme: warning -->

> Due to a windows compatability issue, this option must NOT be passed last on a windows host.

`-u [MONGO_URI]` **required** The url of the mongo database for credential agent

### Examples

Executing without dids

```
./agentdb-cli offers -u mongodb://localhost:27017/test-mockvendor
```

Executing with dids

```
./agentdb-cli offers -d did:ion:foo -d did:ion:bar -u mongodb://localhost:27017/test-mockvendor
```