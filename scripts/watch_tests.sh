#!/usr/bin/env bash
# Automatically watches the tests/ directory and re-generates src/tests_catalog.json
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "==> Performing initial test catalog generation..."
python3 scripts/generate_catalog.py

echo "==> Watching 'tests/' for new/modified test files (Press Ctrl+C to stop)..."
while true; do
  inotifywait -r -e create,modify,delete,move tests/ 2>/dev/null
  echo "==> Change detected in tests/. Updating catalog..."
  python3 scripts/generate_catalog.py
done
