#!/bin/sh
# Build the thumbnail tier used by select tiles, briefings, hi-scores and dialog avatars.
# assets/thumb/<name>.webp is a 192 × 288 box-filtered copy of assets/web/<name>.webp.
# Usage: scripts/make-thumbs.sh   (needs ImageMagick 7: magick)
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$root/assets/thumb"
for src in "$root"/assets/web/*-arcade-*.webp; do
  name=$(basename "$src")
  magick "$src" -filter Box -resize 192x288 -strip -quality 90 -define webp:method=6 "$root/assets/thumb/$name"
done
ls -l "$root/assets/thumb"
