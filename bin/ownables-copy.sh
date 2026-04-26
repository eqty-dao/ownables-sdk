#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: yarn ownables:copy <from> <to>"
  exit 1
fi

from="$1"
to="$2"

src_dir="./ownables/$from"
dst_dir="./ownables/$to"

if [ ! -d "$src_dir" ]; then
  echo "Source ownable does not exist: $src_dir"
  exit 1
fi

if [ -e "$dst_dir" ]; then
  echo "Destination already exists: $dst_dir"
  exit 1
fi

cp -R "$src_dir" "$dst_dir"

cargo_toml="$dst_dir/Cargo.toml"
schema_rs="$dst_dir/examples/schema.rs"
workspace_toml="./ownables/Cargo.toml"

if [ -f "$cargo_toml" ]; then
  if [[ "$to" == ownable-* ]]; then
    new_package_name="$to"
  else
    new_package_name="ownable-$to"
  fi

  old_package_name="$(awk -F '"' '
    /^\[package\]$/ { in_package = 1; next }
    in_package && /^name = / { print $2; exit }
  ' "$cargo_toml")"

  if [ -z "$old_package_name" ]; then
    echo "Unable to determine package name in: $cargo_toml"
    exit 1
  fi

  old_crate_name="${old_package_name//-/_}"
  new_crate_name="${new_package_name//-/_}"

  tmp="$(mktemp)"
  awk -v new_name="$new_package_name" '
    BEGIN {
      in_package = 0
      replaced = 0
    }
    /^\[package\]$/ {
      in_package = 1
      print
      next
    }
    /^\[/ && $0 != "[package]" {
      in_package = 0
    }
    in_package && /^name = / && !replaced {
      print "name = \"" new_name "\""
      replaced = 1
      next
    }
    {
      print
    }
    END {
      if (!replaced) {
        exit 1
      }
    }
  ' "$cargo_toml" > "$tmp"
  mv "$tmp" "$cargo_toml"

  if [ -f "$schema_rs" ]; then
    sed -i \
      -e "s/^use ${old_crate_name}::msg::/use ${new_crate_name}::msg::/" \
      -e "s/^use ${old_crate_name}::state::/use ${new_crate_name}::state::/" \
      "$schema_rs"
  fi
fi

if [ -f "$workspace_toml" ]; then
  if ! grep -q "\"$to\"" "$workspace_toml"; then
    tmp="$(mktemp)"
    awk -v member="$to" '
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
        print "  \"" member "\","
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
    ' "$workspace_toml" > "$tmp"
    mv "$tmp" "$workspace_toml"
  fi
fi

echo "Copied $from -> $to"
