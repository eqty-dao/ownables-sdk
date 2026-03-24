#!/usr/bin/env bash
set -e

build_package() {
  local name=$1
  local dir="./ownables/$name"

  if [ -f "$dir/Cargo.toml" ]; then
    rm -rf "$dir/pkg/"
    wasm-pack build --out-name ownable --target web "$dir/"
    (cd "$dir" && cargo schema)
    zip -r -j "./ownables/$name.zip" "$dir/assets/" "$dir/pkg/ownable_bg.wasm" "$dir/pkg/package.json" "$dir/schema/"*.json
  else
    zip -r -j "./ownables/$name.zip" "$dir/"*
  fi
}

if [ -n "$1" ]; then
  build_package "$1"
else
  for dir in ./ownables/*/; do
    name="$(basename "$dir")"
    [ "$name" = "target" ] && continue
    build_package "$name"
  done
fi
