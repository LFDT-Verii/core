# Legacy Truffle Migrations Policy

## Decision
Use an **archive strategy** for legacy Truffle assets and keep Hardhat as the only active deployment/upgrade toolchain.

## Archive Location
Legacy Truffle files are preserved under:
- `contracts/legacy-truffle/permissions/*`
- `contracts/legacy-truffle/verification-coupon/*`
- `contracts/legacy-truffle/metadata-registry/*`
- `contracts/legacy-truffle/revocation-list/*`

Archived content includes historical:
- `migrations/`
- `truffle-config.js`
- `migration-status.js`

## What This Means
- Archived Truffle files are retained as historical records only.
- New deployment and upgrade operations must use Hardhat scripts (`contracts/*/hardhat/*.js`).
- No new Truffle migration scripts should be added.
- CI/operator procedures should not invoke `truffle migrate` for managed network changes.
- Truffle toolchain dependencies are removed from contract workspace packages.
- Contract package scripts no longer expose Truffle build/test/migrate commands.

## Why Archive (Not a Compatibility Wrapper)
- Reduces operational ambiguity: one write path (Hardhat) instead of two.
- Prevents drift between Truffle migration state and OpenZeppelin Hardhat manifests.
- Keeps migration from current on-chain proxy state explicit and reproducible.
- Lowers maintenance and review overhead on production deployment logic.

## Operational Source of Truth
- Proxy addresses are resolved from:
1. Explicit environment variables.
2. OpenZeppelin manifest files (`unknown-<chainId>.json`).

For managed networks, these manifest/state files are maintained in the engineering deployment repository (not this repo).

## Non-Goals
- This policy does not keep Truffle as an active deployment path.
- This policy does not introduce a Truffle-to-Hardhat shim layer.
