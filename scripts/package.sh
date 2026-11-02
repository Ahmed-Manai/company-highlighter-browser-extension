#!/usr/bin/env bash
# Build the store-ready zip: dist/company-highlighter-<version>.zip
# Only the files the browser needs are included (no tests, scripts or docs).
set -euo pipefail

cd "$(dirname "$0")/.."
version=$(node -p "require('./manifest.json').version")
out="dist/company-highlighter-${version}.zip"

mkdir -p dist
rm -f "$out"
zip -q -r "$out" \
  manifest.json \
  background.js content.js matcher.js settings.js options.js popup.js \
  options.html popup.html \
  styles.css ui.css \
  icons \
  LICENSE

echo "$out"
