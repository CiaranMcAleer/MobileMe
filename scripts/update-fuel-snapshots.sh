#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$REPO_ROOT"

: "${FUEL_FINDER_CLIENT_ID:?FUEL_FINDER_CLIENT_ID must be set}"
: "${FUEL_FINDER_CLIENT_SECRET:?FUEL_FINDER_CLIENT_SECRET must be set}"
export FUEL_FINDER_ENVIRONMENT="${FUEL_FINDER_ENVIRONMENT:-production}"

npm run refresh-data

git add public/data/latest-fuelprices.csv public/data/latest-fuelprices.json public/data/history/

if git diff --cached --quiet; then
  echo "Fuel snapshots unchanged; nothing to commit."
  exit 0
fi

commit_date=$(date +%F)
git commit -m "Refresh Fuel Finder snapshots ${commit_date}"

if [ "${PUSH_CHANGES:-1}" = "1" ]; then
  git push origin main
else
  echo "PUSH_CHANGES=${PUSH_CHANGES:-0}; leaving commit unpushed."
fi
