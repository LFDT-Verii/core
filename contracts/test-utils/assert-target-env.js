#!/usr/bin/env node

const allowed = new Set(['localdocker', 'dev', 'staging', 'prod']);
const targetEnv = process.env.TARGET_ENV;

if (!allowed.has(targetEnv)) {
  console.error(
    'TARGET_ENV must be one of localdocker, dev, staging, prod',
  );
  process.exit(1);
}
