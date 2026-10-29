#!/usr/bin/env bash
# Invoked by .githooks/pre-commit. Light mechanical checks only (no ci:all).

# shellcheck source=staged-checks.sh
source "$(dirname "$0")/staged-checks.sh"

cd "$(repo_root)"

if [[ -z $(git diff --cached --name-only) ]]; then
  exit 0
fi

run_staged_mechanical_checks
