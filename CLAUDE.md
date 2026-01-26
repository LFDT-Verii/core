# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Verii is a Verifiable Credentials (VC) platform monorepo containing libraries, servers, smart contracts, and tools for credential issuance and verification. Uses Yarn workspaces, Lerna for versioning, and Nx for build orchestration.

## Commands

### Building
```bash
yarn build              # Build all packages
yarn build:affected     # Build only packages affected by changes
yarn build:lib          # Build library packages only (tagged with lib)
```

### Setup test environment
```bash
docker run --name mongo -p 27017:27017 -d mongo:8
docker run --name blockchain -p 8545:8545 -d velocitynetworkfoundation/blockchain-dev
docker run --name localstack -p 4566:4566 -p 4571:4571 -d localstack/localstack:2.3.2
```

### Run all tests
```bash
yarn test
```

### Run tests for affected packages only
```bash
yarn test:affected
```

### Run tests for a specific package
```bash
yarn nx run <package>:test
```

### Run a single test file (Node.js test runner)
```bash
node --test --experimental-test-module-mocks 'path/to/file.test.js'
```

Tests use Node.js built-in test runner (`node --test`), not Jest. Some tests require MongoDB replica set and/or Besu blockchain node running locally.

### Linting
```bash
yarn lint               # Lint all packages
yarn lint:fix           # Lint and auto-fix all packages
yarn lint:affected      # Lint only affected packages
```

### Docker (for local development)
```bash
yarn start              # docker-compose up
yarn start:rebuild      # docker-compose up --build
yarn stop               # docker-compose down -v
```

### Credential Agent Migrations
cd servers/credentialagent
All migrations are run in a particular environment. Default is localdev

#### Check migration status
```bash
MIGRATION_ENV=<env> yarn migrate:status
```
```bash
MIGRATION_ENV=<env> yarn migrate:up        # Run migrations
```
```bash
MIGRATION_ENV=<env> yarn migrate:down       # Rollback last migration
```
```bash
MIGRATION_ENV=<env> yarn migrate:create     # Create new migration
```

## Architecture

### Workspaces Structure
- `packages/` - Shared libraries (43 packages), tagged as `lib` in Nx
- `servers/` - Server applications (credentialagent, mockvendor)
- `contracts/` - Solidity smart contracts for blockchain (Truffle-based)
- `tools/` - CLI utilities (verifgen, agentdb-cli, vnf-agent-cli)
- `samples/` - Sample applications demonstrating usage

### Key Library Packages
- `verii-issuing` - VC issuance logic
- `verii-verification` - VC/VP verification logic
- `vnf-wallet-sdk-nodejs` - TypeScript wallet SDK (only TS package, has build step)
- `jwt` - JWT handling
- `crypto` - Cryptographic operations
- `did-doc`, `did-web` - DID document handling
- `blockchain-functions` - Blockchain interaction utilities
- `common-functions`, `common-fetchers` - Shared utilities

### Servers
- `credentialagent` - Main Fastify server for credential operations. Entry points: `main.js` (full), `main-operator.js`, `main-holder.js`
- `mockvendor` - Mock vendor for testing

### Smart Contracts
Solidity contracts under `contracts/` use Truffle. Key contracts:
- `metadata-registry` - Credential type metadata
- `permissions` - Access control
- `revocation-list` - Credential revocation
- `verification-coupon` - Verification payment

## Code Conventions

### Linting Rules (enforced by ESLint)
- Immutability: `better-mutation` plugin enforces no mutations (exceptions in tests)
- Arrow functions preferred
- Max complexity: 6
- Max nesting depth: 2
- Max line length: 150
- Single quotes, trailing commas
- No `for...in` loops (use Object.keys/values/entries)

### Commits
Uses Conventional Commits (`@commitlint/config-conventional`). Format: `type(scope): description`
Signoff commits

## Requirements

- Node.js 22.x (see `.nvmrc` for exact version)
- Yarn 1.x (classic)
