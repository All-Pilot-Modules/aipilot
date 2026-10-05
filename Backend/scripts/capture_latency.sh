#!/usr/bin/env bash
# Run from an already configured backend environment; logs stay private.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
capture_log=$(mktemp /tmp/aipilot-capture-XXXXXX.log)
printf 'Capturing API and local worker logs to %s\n' "$capture_log"
LATENCY_ENABLED=1 venv/bin/uvicorn main:app --host 127.0.0.1 --port "${PORT:-8000}" 2>&1 | tee "$capture_log"
