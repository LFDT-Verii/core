#!/usr/bin/env bash

set -euo pipefail

readonly image='lfdecentralizedtrust/verii-credentialing-hub:local-smoke'
readonly output_directory="$(mktemp -d)"

cleanup() {
  docker image rm "$image" >/dev/null 2>&1 || true
  rm -rf "$output_directory"
}

trap cleanup EXIT

docker build \
  --build-arg IMAGE_VERSION='0.0.0-local-smoke' \
  --build-arg IMAGE_REVISION='local-smoke' \
  --file servers/credentialinghub/docker/Dockerfile \
  --tag "$image" \
  .

docker image inspect "$image" >"$output_directory/image-inspect.json"

node - "$output_directory/image-inspect.json" <<'NODE'
const fs = require('node:fs');

const [inspection] = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { Config: config } = inspection;

if (config.User !== 'node') {
  throw new Error(`Expected image user to be node, received ${config.User}`);
}

if (JSON.stringify(config.Entrypoint) !== JSON.stringify(['node', 'docker/entrypoint.js'])) {
  throw new Error(`Unexpected image entrypoint: ${JSON.stringify(config.Entrypoint)}`);
}

const forbiddenEnvironment = /^(?:RPC_NODE_URL|CHAIN_ID|REGISTRAR_URL|[A-Z0-9_]*CONTRACT_ADDRESS|VNF_OAUTH_[A-Z0-9_]*|BLOCKCHAIN_OAUTH_[A-Z0-9_]*)=/;
const exposed = (config.Env || []).filter((entry) => forbiddenEnvironment.test(entry));

if (exposed.length > 0) {
  throw new Error(`Image contains forbidden environment values: ${exposed.map((entry) => entry.split('=')[0]).join(', ')}`);
}
NODE

if docker run --rm "$image" --velocity-devn >"$output_directory/unsupported-argument.log" 2>&1; then
  echo 'Expected unsupported image argument to fail' >&2
  exit 1
fi

if ! grep -Fq 'Unsupported Credentialing Hub image argument' "$output_directory/unsupported-argument.log"; then
  echo 'Unsupported image argument error was not reported' >&2
  exit 1
fi

readonly supplied_chain_id='424242'
if docker run --rm -e "CHAIN_ID=$supplied_chain_id" "$image" --mainnet >"$output_directory/preset-conflict.log" 2>&1; then
  echo 'Expected a changed mainnet CHAIN_ID to fail' >&2
  exit 1
fi

if ! grep -Fq "CHAIN_ID can't be changed on mainnet" "$output_directory/preset-conflict.log"; then
  echo 'Mainnet preset conflict did not name CHAIN_ID' >&2
  exit 1
fi

if grep -Fq "$supplied_chain_id" "$output_directory/preset-conflict.log"; then
  echo 'Mainnet preset conflict leaked the supplied CHAIN_ID value' >&2
  exit 1
fi

package_name="$(docker run --rm --entrypoint node "$image" -p "require('/app/package.json').name")"
if [[ "$package_name" != '@verii/server-credentialing-hub' ]]; then
  echo "Unexpected deployed package name: $package_name" >&2
  exit 1
fi
