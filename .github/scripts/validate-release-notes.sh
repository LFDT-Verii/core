#!/usr/bin/env bash

set -euo pipefail

release_notes_file="${1:-}"

if [ -z "${release_notes_file}" ]; then
  echo "Usage: $0 <release-notes-file>"
  exit 1
fi

if [ ! -f "${release_notes_file}" ]; then
  echo "Missing release notes file: ${release_notes_file}"
  exit 1
fi

grep -q '^## Changes$' "${release_notes_file}" || { echo "${release_notes_file} is missing a '## Changes' section."; exit 1; }
grep -q '^## Backward incompatibilities$' "${release_notes_file}" || { echo "${release_notes_file} is missing a '## Backward incompatibilities' section."; exit 1; }
grep -Eq '^### \[#[^]]+\]\([^)]+\)( .*)?$' "${release_notes_file}" || { echo "${release_notes_file} must include at least one release entry heading in the form '### [#PR](...) ...'."; exit 1; }
