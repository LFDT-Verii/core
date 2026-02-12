# Hardhat Migration Runbook (Phase 1)

This runbook covers the Hardhat deploy/upgrade commands added as a replacement path for Truffle-based migrations.

## Contract Workspaces
- `@verii/permissions-contract`
- `@verii/verification-coupon-contract`
- `@verii/metadata-registry-contract`
- `@verii/revocation-list-contract`

## Build and Clean
- Build all Hardhat artifacts:
  - `yarn contracts:build:hardhat`
- Clean all Hardhat artifacts:
  - `yarn contracts:clean:hardhat`

## Environment Mapping
Networks are configured from environment variables in `contracts/hardhat.shared.js`.

- `localdocker`
  - `HARDHAT_LOCALDOCKER_RPC_URL` (default `http://localhost:8545`)
  - `HARDHAT_LOCALDOCKER_PRIVATE_KEY`
  - `HARDHAT_LOCALDOCKER_CHAIN_ID` (default `2020`)
- `dev|qa|staging|prod`
  - `HARDHAT_<ENV>_RPC_URL`
  - `HARDHAT_<ENV>_PRIVATE_KEY`
  - `HARDHAT_<ENV>_CHAIN_ID`

## Deploy Flows
Root orchestration:
- `yarn contracts:deploy:hardhat:localdocker`
- `yarn contracts:deploy:hardhat:dev`
- `yarn contracts:deploy:hardhat:qa`
- `yarn contracts:deploy:hardhat:staging`
- `yarn contracts:deploy:hardhat:prod`

Upgrade flows:
- `yarn contracts:upgrade:hardhat:localdocker`
- `yarn contracts:upgrade:hardhat:dev`
- `yarn contracts:upgrade:hardhat:qa`
- `yarn contracts:upgrade:hardhat:staging`
- `yarn contracts:upgrade:hardhat:prod`

## Address Resolution
Deploy/upgrade scripts resolve proxy addresses from:
1. Explicit env vars (e.g. `PERMISSIONS_PROXY_ADDRESS`, `COUPON_PROXY_ADDRESS`, `METADATA_PROXY_ADDRESS`, `REVOCATION_PROXY_ADDRESS`)
2. `.openzeppelin/unknown-<chainId>.json` manifests

For verification-coupon, proxy selection defaults to index `1` for upgrades (legacy V2 behavior). Override with `COUPON_PROXY_INDEX` when needed.

## Engineering Wrapper
Primary operator entrypoint is in `engineering`:
- `../engineering/deploy/scripts/release.sh`

Recommended pre-deploy command:
- `../engineering/deploy/scripts/release.sh --chain-id 1480 --verii-ref <sha> --env dev --mode upgrade --dry-run`
