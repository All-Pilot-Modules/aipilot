#!/usr/bin/env bash
# First-time setup for a fresh clone of the Backend.
# Safe to re-run: skips steps that are already done instead of redoing them.
#
# Usage:
#   cd Backend
#   ./scripts/setup.sh

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."   # always run from Backend/, regardless of cwd

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}==>${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; }

# ── 1. Python version ────────────────────────────────────────────────────
# CI (.github/workflows/ci.yml) and the production Dockerfile both pin
# Python 3.13, so that's the version this project is actually tested
# against. Older 3.10/3.11 happen to work too (no C-extension in
# requirements.txt requires 3.13 specifically) but 3.13 is what "should work"
# is measured against — prefer it if available, otherwise fall back and warn.
info "Checking Python version..."
PYTHON_BIN=""
for candidate in python3.13 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON_BIN="$candidate"
        break
    fi
done
if [ -z "$PYTHON_BIN" ]; then
    fail "No python3 found on PATH. Install Python 3.13 and re-run."
    exit 1
fi

PY_VERSION=$("$PYTHON_BIN" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
PY_MAJOR=$("$PYTHON_BIN" -c 'import sys; print(sys.version_info[0])')
PY_MINOR=$("$PYTHON_BIN" -c 'import sys; print(sys.version_info[1])')

if [ "$PY_MAJOR" -ne 3 ] || [ "$PY_MINOR" -lt 10 ]; then
    fail "Found Python $PY_VERSION ($PYTHON_BIN). This project needs Python 3.10+ (3.13 recommended, matches CI/production)."
    exit 1
elif [ "$PY_MINOR" -lt 13 ]; then
    warn "Using Python $PY_VERSION ($PYTHON_BIN). CI and production run 3.13 — this should still work, but if you hit a dependency error, install 3.13 and re-run this script."
else
    ok "Python $PY_VERSION ($PYTHON_BIN)"
fi

# ── 2. Virtualenv ────────────────────────────────────────────────────────
if [ -d "venv" ]; then
    ok "venv/ already exists, reusing it"
else
    info "Creating virtualenv..."
    "$PYTHON_BIN" -m venv venv
    ok "Created venv/"
fi

# shellcheck disable=SC1091
source venv/bin/activate

# ── 3. Dependencies ──────────────────────────────────────────────────────
info "Installing dependencies (this can take a few minutes, llama-index is large)..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
ok "Dependencies installed"

# ── 4. .env ───────────────────────────────────────────────────────────────
if [ -f ".env" ]; then
    ok ".env already exists, leaving it as-is"
else
    cp .env.example .env
    warn "Created .env from .env.example — you MUST fill in real values before the server will work:"
    warn "  OPENAI_API_KEY, DATABASE_URL, JWT_SECRET (required)"
    warn "  SUPABASE_URL / SUPABASE_SERVICE_KEY (required for file uploads)"
    warn "  EMAIL_* (only needed for email verification flows)"
fi

# ── 5. Local storage directories ────────────────────────────────────────
# Defaults from .env.example — used for uploaded files, llama-index storage,
# and parsed document cache. Not created automatically by the app.
for dir in uploads index_store parsed_docs; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        ok "Created $dir/"
    fi
done

# ── 6. Database migrations ──────────────────────────────────────────────
DB_URL=$(grep -E '^DATABASE_URL=' .env | cut -d'=' -f2- || true)
if [ -z "$DB_URL" ] || [ "$DB_URL" = "your_database_url" ]; then
    warn "DATABASE_URL isn't set in .env yet — skipping migrations."
    warn "Once it's set, run: source venv/bin/activate && alembic upgrade head"
else
    info "Running database migrations..."
    if alembic upgrade head; then
        ok "Database schema is up to date"
    else
        fail "Migrations failed — check DATABASE_URL is correct and the database is reachable."
        warn "You can retry with: source venv/bin/activate && alembic upgrade head"
    fi
fi

# ── Done ─────────────────────────────────────────────────────────────────
echo
ok "Setup complete."
echo
echo "Next steps:"
[ -f ".env" ] && grep -q "your-openai-api-key\|your_database_url\|your-super-secret-jwt" .env 2>/dev/null && \
    echo "  1. Fill in the real secrets in .env (OPENAI_API_KEY, DATABASE_URL, JWT_SECRET, ...)"
echo "  2. source venv/bin/activate"
echo "  3. uvicorn main:app --reload --port 8000"
echo
echo "See DEPLOY.md for production/Cloud Run config, docs/ for architecture notes."
