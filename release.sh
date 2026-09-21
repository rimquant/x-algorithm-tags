#!/bin/sh
set -eu

cd "$(dirname "$0")"
root=$PWD
version=$(node -p 'JSON.parse(require("fs").readFileSync("manifest.json", "utf8")).version')
tag="v$version"
output="$root/dist/x-recommendation-checker-$tag.zip"
mode=${1:-build}

case "$mode" in
  build|--publish) ;;
  *) echo "Usage: ./release.sh [--publish]" >&2; exit 2 ;;
esac

if [ -n "${GITHUB_REF_NAME:-}" ] && [ "$GITHUB_REF_NAME" != "$tag" ]; then
  echo "Tag $GITHUB_REF_NAME does not match manifest version $version" >&2
  exit 1
fi

mkdir -p "$root/dist"
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

if [ "$mode" = "--publish" ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "Commit all changes before publishing" >&2
    exit 1
  fi
  if [ "$(git branch --show-current)" != "main" ]; then
    echo "Publish from the main branch" >&2
    exit 1
  fi

  git fetch --quiet --tags origin main
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "Local main must match origin/main" >&2
    exit 1
  fi
  if git show-ref --verify --quiet "refs/tags/$tag"; then
    echo "Tag already exists: $tag" >&2
    exit 1
  fi

  git tag -a "$tag" -m "Release $tag"
  git push origin "$tag"
  echo "Pushed $tag; GitHub Actions will create the release"
fi
