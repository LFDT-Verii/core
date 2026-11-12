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

// The image presets no network: its operator sets every network value
const forbiddenEnvironment = /^(?:NETWORK|RPC_NODE_URL|CHAIN_ID|REGISTRAR_URL|LIB_URL|DEEP_LINK_PROTOCOL|CREDENTIAL_EXTENSIONS_CONTEXT_URL|BLOCKCHAIN_API_AUDIENCE|[A-Z0-9_]*CONTRACT_ADDRESS|VNF_OAUTH_[A-Z0-9_]*|BLOCKCHAIN_OAUTH_[A-Z0-9_]*)=/;
const exposed = (config.Env || []).filter((entry) => forbiddenEnvironment.test(entry));

if (exposed.length > 0) {
  throw new Error(`Image contains forbidden environment values: ${exposed.map((entry) => entry.split('=')[0]).join(', ')}`);
}
NODE

# The image takes no arguments, including the network flags it used to take
for argument in --mainnet --velocity-devnet --unsupported; do
  status=0
  docker run --rm "$image" "$argument" >"$output_directory/unsupported-argument.log" 2>&1 || status=$?

  if [[ "$status" -ne 64 ]]; then
    echo "Expected image argument $argument to fail with exit code 64, received $status" >&2
    exit 1
  fi

  if ! grep -Fq 'Unsupported Credentialing Hub image argument' "$output_directory/unsupported-argument.log" ||
    ! grep -Fq 'no longer presets a network' "$output_directory/unsupported-argument.log"; then
    echo "Image argument $argument was not reported as unsupported" >&2
    exit 1
  fi
done

package_name="$(docker run --rm --entrypoint node "$image" -p "require('/app/package.json').name")"
if [[ "$package_name" != '@verii/server-credentialing-hub' ]]; then
  echo "Unexpected deployed package name: $package_name" >&2
  exit 1
fi
