#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm ci
exec npx playwright test "$@"
