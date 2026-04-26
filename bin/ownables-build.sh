#!/usr/bin/env bash
set -euo pipefail

ensure_workspace_member() {
  local name=$1
  local ownables_workspace="./ownables/Cargo.toml"
  local dir="./ownables/$name"

  # Only attempt workspace sync for Rust ownables.
  if [ ! -f "$dir/Cargo.toml" ] && [ ! -f "$dir/Cargo.yaml" ]; then
    return
  fi

  if [ ! -f "$ownables_workspace" ]; then
    return
  fi

  if grep -q "\"$name\"" "$ownables_workspace"; then
    return
  fi

  local tmp
  tmp="$(mktemp)"

  awk -v pkg="$name" '
    BEGIN {
      in_workspace = 0
      in_members = 0
      inserted = 0
    }
    /^\[workspace\]/ {
      in_workspace = 1
    }
    in_workspace && !in_members && /^[[:space:]]*members[[:space:]]*=[[:space:]]*\[/ {
      in_members = 1
      print
      next
    }
    in_members && /^[[:space:]]*\]/ {
      print "  \"" pkg "\","
      print
      in_members = 0
      inserted = 1
      next
    }
    {
      print
    }
    END {
      if (!inserted) {
        exit 1
      }
    }
  ' "$ownables_workspace" > "$tmp"

  mv "$tmp" "$ownables_workspace"
}

build_package() {
  local name=$1
  local dir="./ownables/$name"

  ensure_workspace_member "$name"

  if [ -f "$dir/Cargo.toml" ]; then
    local package_name
    local package_version
    local package_description
    local crate_name
    local wasm_path

    package_name="$(awk -F '\"' '/^name = /{print $2; exit}' "$dir/Cargo.toml")"
    package_version="$(awk -F '\"' '/^version = /{print $2; exit}' "$dir/Cargo.toml")"
    package_description="$(awk -F '\"' '/^description = /{print $2; exit}' "$dir/Cargo.toml" || true)"
    crate_name="${package_name//-/_}"
    wasm_path="./ownables/target/wasm32-unknown-unknown/release/${crate_name}.wasm"

    rm -rf "$dir/pkg/"
    mkdir -p "$dir/pkg/"

    (
      cd ./ownables
      cargo build -p "$package_name" --target wasm32-unknown-unknown --release
    )

    cp "$wasm_path" "$dir/pkg/ownable_bg.wasm"

    jq -n \
      --arg name "$package_name" \
      --arg version "$package_version" \
      --arg description "$package_description" \
      --arg ownablesAbi "1" \
      --arg wireFormat "cbor" \
      '{
        name: $name,
        version: $version,
        description: $description,
        ownablesAbi: $ownablesAbi,
        wireFormat: $wireFormat
      }' > "$dir/pkg/package.json"

    (cd "$dir" && cargo schema)
    zip -r -j "./ownables/$name.zip" "$dir/assets/" "$dir/pkg/ownable_bg.wasm" "$dir/pkg/package.json" "$dir/schema/"*.json
  else
    zip -r -j "./ownables/$name.zip" "$dir/"*
  fi
}

if [ -n "${1-}" ]; then
  build_package "$1"
else
  for dir in ./ownables/*/; do
    name="$(basename "$dir")"
    [ "$name" = "target" ] && continue
    build_package "$name"
  done
fi
