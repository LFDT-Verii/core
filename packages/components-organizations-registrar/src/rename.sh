#!/bin/zsh

#
# Copyright 2025 Velocity Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
#

DRY_RUN=false

# Check for --dry-run flag
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🧪 Dry run mode: no files will be modified"
fi

echo "🔍 Scanning for relative imports without extensions..."

find . -type f \( -name "*.js" -o -name "*.jsx" \) | while read -r file; do
  while IFS= read -r line; do
    # Only check lines that look like relative imports
    if [[ "$line" == *import* && "$line" == *from* && "$line" == *\'.* ]]; then
      # Extract the import path
      import_path=$(echo "$line" | sed -E "s/.*from ['\"]([^'\"]+)['\"].*/\1/")
      # Only look at local paths with no extension
      if [[ "$import_path" == ./* || "$import_path" == ../* ]]; then
        dir_path="$(dirname "$file")"
        full_path="${dir_path}/${import_path}.jsx"

        if [[ -f "$full_path" ]]; then
          if $DRY_RUN; then
            echo "🔍 Would patch: $file → $import_path.jsx"
          else
            # Escape for sed (macOS/BSD)
#            escaped_path=$(echo "$import_path" | sed -E 's/[\/&]/\\&/g')
#            echo "$escaped_path"
            sed -i '' "s#from[[:space:]]'$import_path'#from '$import_path.jsx'#" "$file"
            echo "✅ Patched $file → $import_path.jsx"
          fi
        fi
      fi
    fi
  done < "$file"
done

if $DRY_RUN; then
  echo "✅ Dry run complete — no changes made"
else
  echo "✨ Done fixing .jsx import paths!"
fi