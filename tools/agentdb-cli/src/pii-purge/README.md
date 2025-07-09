# pii-purge command

Used for clearing credential subject of finalizing offers.

### Steps

1. Create offers with consentedAt or rejectedAt field.
2. Execute the command

## How to Use

`data-loader pii-purge [options]`

### Options

`-u [MONGO_URI]` **required** The url of the mongo database for credential agent

### Examples

Executing

```
./agentdb-cli pii-purge -u mongodb://localhost:27017/test-credentialagent
```