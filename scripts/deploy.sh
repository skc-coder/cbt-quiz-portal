#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "==> Re-building test catalog..."
python3 scripts/generate_catalog.py

echo "==> Staging files for Cloudflare Pages deploy..."
STAGE_DIR="/tmp/examoverflow_dist"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

rsync -a --exclude="examoverflow.zip" --exclude="examoverflow.xpi" --exclude=".git" --exclude="*.log" . "$STAGE_DIR/"

echo "==> Deploying to Cloudflare Pages (gate-cbt-quiz-addon)..."
npx wrangler pages deploy "$STAGE_DIR" --project-name=gate-cbt-quiz-addon --commit-dirty=true

rm -rf "$STAGE_DIR"
echo "==> Live at https://gate-cbt-quiz-addon.pages.dev"
