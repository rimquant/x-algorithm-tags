#!/bin/sh
set -eu

cd "$(dirname "$0")"
version=$(node -p 'JSON.parse(require("fs").readFileSync("manifest.json", "utf8")).version')
output=${1:-"../x-recommendation-checker-v${version}.zip"}

case "$output" in
  /*) ;;
  *) output="$PWD/$output" ;;
esac

if [ -e "$output" ]; then
  echo "Refusing to overwrite: $output" >&2
  exit 1
fi

mkdir -p "$(dirname "$output")"
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/x-recommendation-checker.XXXXXX")
archive="$tmp_dir/release.zip"
trap 'rm -f "$archive"; rmdir "$tmp_dir" 2>/dev/null || true' EXIT INT TERM

node test.mjs
zip -q "$archive" \
  LICENSE \
  manifest.json \
  background.js capture-main.js content.js labels.mjs report.mjs \
  popup.html popup.css popup.mjs \
  icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png
unzip -tq "$archive" >/dev/null
mv "$archive" "$output"

echo "Created $output"
