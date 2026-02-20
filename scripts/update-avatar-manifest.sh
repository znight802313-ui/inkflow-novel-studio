#!/bin/bash

# Script to update avatar manifest
# Run this script whenever you add new avatars to public/avatars/

cd "$(dirname "$0")/../public/avatars" || exit 1

echo "Scanning avatars folder..."

# Generate manifest file
find . -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webp" \) -exec basename {} \; | jq -R -s -c 'split("\n") | map(select(length > 0))' > avatars-manifest.json

# Count avatars
count=$(jq '. | length' avatars-manifest.json)

echo "✅ Avatar manifest updated!"
echo "📊 Total avatars: $count"
echo "📁 Manifest file: public/avatars/avatars-manifest.json"
