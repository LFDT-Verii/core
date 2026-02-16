# Hardhat Migration Runbook

This runbook defines the operator path for migrating from the current on-chain proxy state on devnet/testnet/mainnet.

See also: `contracts/LEGACY_MIGRATIONS_POLICY.md`.

## Scope
- `@verii/permissions-contract`
- `@verii/verification-coupon-contract`
- `@verii/metadata-registry-contract`
- `@verii/revocation-list-contract`

## Legacy Migration Handling
Decision: archive legacy Truffle files under `contracts/legacy-truffle/*` and use Hardhat only for active deployments/upgrades.

## Build Commands
From repository root:
- Build hardhat artifacts: `yarn contracts:build:hardhat`
- Clean hardhat artifacts: `yarn contracts:clean:hardhat`

## Network Mapping
Hardhat scripts in this repo expose `dev`, `staging`, `prod` networks.
Operator flow maps managed environments as follows:

- `devnet` -> hardhat `dev` -> chainId `1480`
- `testnet` -> hardhat `staging` -> chainId `1481`
- `mainnet` -> hardhat `prod` -> chainId `1482`

Post-upgrade smoke test scripts use the same environment names as Hardhat networks: `localdocker`, `dev`, `staging`, `prod`.
Smoke tests use the same Hardhat RPC/auth runtime as deploy/upgrade scripts for each environment.

## Address Resolution Order
Deploy/upgrade scripts resolve contract proxies from:
1. Explicit env vars (`PERMISSIONS_PROXY_ADDRESS`, `COUPON_PROXY_ADDRESS`, `METADATA_PROXY_ADDRESS`, `REVOCATION_PROXY_ADDRESS`)
2. OpenZeppelin manifests (`.openzeppelin/unknown-<chainId>.json`)

Managed-network manifest/state files are maintained in the engineering deployment repo.

## Operator Entry Point
Use the engineering wrapper (from engineering repo root):
- `./deploy/scripts/release.sh`

## Managed-Network Flow (From Current On-Chain State)
1. Prepare deployment context in engineering repo.
- Ensure public vars exist for target env (`devnet-vars.json`, `testnet-vars.json`, `mainnet-vars.json`).
- Ensure secret vars exist where required (for example `devnet-secret-vars.json`) and are not committed.
- Ensure correct `unknown-<chainId>.json` files are present in engineering deployment context.

2. Run dry-run first.
- Devnet: `./deploy/scripts/release.sh --env devnet --chain-id 1480 --verii-ref <sha> --mode upgrade --dry-run`
- Testnet: `./deploy/scripts/release.sh --env testnet --chain-id 1481 --verii-ref <sha> --mode upgrade --dry-run`
- Mainnet: `./deploy/scripts/release.sh --env mainnet --chain-id 1482 --verii-ref <sha> --mode upgrade --dry-run`

3. Execute devnet upgrade.
- `./deploy/scripts/release.sh --env devnet --chain-id 1480 --verii-ref <sha> --mode upgrade`

4. Validate devnet post-upgrade.
- Confirm emitted proxy addresses match expected manifests.
- Confirm critical wiring:
  - coupon/revocation/metadata `getPermissionsAddress()`
  - metadata `checkAddressScope(metadata, 'coupon:burn')`
- Run post-upgrade smoke tests (read-only checks; no deploy/upgrade transactions):
  - `TARGET_ENV=dev yarn contracts:test:post-upgrade`
- Run integration tests from engineering/verii flow that deploy and interact with contracts.

5. Promote same commit to testnet.
- Run upgrade (no dry-run), then repeat validation checks.
- Run smoke checks:
  - `TARGET_ENV=staging yarn contracts:test:post-upgrade`

6. Promote same commit to mainnet.
- Run upgrade (no dry-run), then repeat validation checks.
- Run smoke checks:
  - `TARGET_ENV=prod yarn contracts:test:post-upgrade`

## New-Chain Bootstrap (Hardhat-Only, From Scratch)
Use this when deploying to a brand-new chain with no existing proxy manifests.

1. Configure the new network in `contracts/hardhat.shared.js` (or reuse an existing env alias) with:
- RPC URL
- chain ID
- funded deployer private key

2. Execute Hardhat deploy chain in order:
- permissions deploy
- verification-coupon deploy
- metadata-registry deploy
- revocation-list deploy

From repository root this is typically:
- `TARGET_ENV=<network> yarn contracts:deploy:hardhat`

3. Capture emitted proxy addresses and persist deployment state into the engineering deployment context (`unknown-<chainId>.json` and env vars as required).

4. Run post-deploy validation:
- each proxy responds on-chain
- permissions wiring is correct on coupon/metadata/revocation
- metadata has `coupon:burn` scope configured

## Failure Handling
- Scripts are fail-fast by design.
- If a step fails mid-sequence:
1. fix root cause (auth/rpc/manifest/address mismatch)
2. rerun the same `release.sh` command for that environment
3. re-validate addresses and wiring

## Notes
- Verification-coupon proxy resolution defaults to legacy index behavior for upgrades; override with `COUPON_PROXY_INDEX` when needed.
- For production changes, always use explicit commit SHA (`--verii-ref <sha>`).
