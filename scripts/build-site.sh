#!/bin/sh
# Assemble the deployable site from an explicit allowlist.
# Usage: scripts/build-site.sh <output-dir> [cache-version]
# With a cache version (e.g. a short commit SHA), the copied sw.js is stamped with it.
set -eu
out=${1:?usage: build-site.sh <output-dir> [cache-version]}
version=${2:-}
root=$(cd "$(dirname "$0")/.." && pwd)

rm -rf "$out"
mkdir -p "$out"
for item in index.html style.css app.js stats.js sw.js manifest.webmanifest .nojekyll journey assets; do
  cp -R "$root/$item" "$out/"
done
find "$out" -name '.DS_Store' -delete

if [ -n "$version" ]; then
  pattern="^const version = '[^']*';\$"
  if [ "$(grep -c "$pattern" "$out/sw.js")" != 1 ]; then
    echo "sw.js: expected exactly one \"const version = '...';\" line to stamp" >&2
    exit 1
  fi
  sed "s/$pattern/const version = '$version';/" "$out/sw.js" > "$out/sw.js.tmp"
  mv "$out/sw.js.tmp" "$out/sw.js"
  grep -q "^const version = '$version';\$" "$out/sw.js" || { echo "sw.js: stamping failed" >&2; exit 1; }
fi
