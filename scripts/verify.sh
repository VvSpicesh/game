#!/usr/bin/env bash
# Nocturne Games verify wrapper
# Usage: ./scripts/verify.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 scripts/verify.py || python scripts/verify.py
