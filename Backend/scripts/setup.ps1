# First-time setup for a fresh clone of the Backend, on Windows (PowerShell).
# Safe to re-run: skips steps that are already done instead of redoing them.
#
# Usage:
#   cd Backend
#   .\scripts\setup.ps1
#
# If PowerShell blocks the script with an "execution policy" error, run:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$ErrorActionPreference = "Stop"

# Always run from Backend/, regardless of cwd
Set-Location (Join-Path $PSScriptRoot "..")

function Info($msg)  { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg)    { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Fail($msg)  { Write-Host "[X] $msg" -ForegroundColor Red }

# -- 1. Python version -----------------------------------------------------
# CI (.github/workflows/ci.yml) and the production Dockerfile both pin
# Python 3.13, so that's the version this project is actually tested
# against. Older 3.10/3.11 happen to work too (no C-extension in
# requirements.txt requires 3.13 specifically) but 3.13 is what "should work"
# is measured against - prefer it if available, otherwise fall back and warn.
Info "Checking Python version..."
$PythonBin = $null
foreach ($candidate in @("py -3.13", "python3.13", "python", "py")) {
    $exe, $arg = $candidate.Split(" ", 2)
    if (Get-Command $exe -ErrorAction SilentlyContinue) {
        try {
            $null = & $exe $arg -c "import sys" 2>$null
            $PythonBin = $candidate
            break
        } catch { continue }
    }
}
if (-not $PythonBin) {
    Fail "No Python found on PATH. Install Python 3.13 from python.org (check 'Add python.exe to PATH') and re-run."
    exit 1
}
$exe, $arg = $PythonBin.Split(" ", 2)
$pyArgs = @()
if ($arg) { $pyArgs += $arg }

$PyVersion = & $exe @pyArgs -c "import sys; print('%d.%d' % sys.version_info[:2])"
$PyMajor = & $exe @pyArgs -c "import sys; print(sys.version_info[0])"
$PyMinor = & $exe @pyArgs -c "import sys; print(sys.version_info[1])"

if ([int]$PyMajor -ne 3 -or [int]$PyMinor -lt 10) {
    Fail "Found Python $PyVersion ($PythonBin). This project needs Python 3.10+ (3.13 recommended, matches CI/production)."
    exit 1
} elseif ([int]$PyMinor -lt 13) {
    Warn "Using Python $PyVersion ($PythonBin). CI and production run 3.13 - this should still work, but if you hit a dependency error, install 3.13 and re-run this script."
} else {
    Ok "Python $PyVersion ($PythonBin)"
}

# -- 2. Virtualenv ----------------------------------------------------------
if (Test-Path "venv") {
    Ok "venv/ already exists, reusing it"
} else {
    Info "Creating virtualenv..."
    & $exe @pyArgs -m venv venv
    Ok "Created venv/"
}

$VenvPython = Join-Path "venv" "Scripts\python.exe"

# -- 3. Dependencies ----------------------------------------------------------
Info "Installing dependencies (this can take a few minutes, llama-index is large)..."
& $VenvPython -m pip install --upgrade pip --quiet
& $VenvPython -m pip install -r requirements.txt --quiet
Ok "Dependencies installed"

# -- 4. .env ------------------------------------------------------------------
if (Test-Path ".env") {
    Ok ".env already exists, leaving it as-is"
} else {
    Copy-Item ".env.example" ".env"
    Warn "Created .env from .env.example - you MUST fill in real values before the server will work:"
    Warn "  OPENAI_API_KEY, DATABASE_URL, JWT_SECRET (required)"
    Warn "  SUPABASE_URL / SUPABASE_SERVICE_KEY (required for file uploads)"
    Warn "  EMAIL_* (only needed for email verification flows)"
}

# -- 5. Local storage directories --------------------------------------------
# Defaults from .env.example - used for uploaded files, llama-index storage,
# and parsed document cache. Not created automatically by the app.
foreach ($dir in @("uploads", "index_store", "parsed_docs")) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Ok "Created $dir/"
    }
}

# -- 6. Database migrations ---------------------------------------------------
$DbUrl = $null
if (Test-Path ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if ($line) { $DbUrl = $line -replace '^DATABASE_URL=', '' }
}

if ([string]::IsNullOrWhiteSpace($DbUrl) -or $DbUrl -eq "your_database_url") {
    Warn "DATABASE_URL isn't set in .env yet - skipping migrations."
    Warn "Once it's set, run: venv\Scripts\Activate.ps1; alembic upgrade head"
} else {
    Info "Running database migrations..."
    & $VenvPython -m alembic upgrade head
    if ($LASTEXITCODE -eq 0) {
        Ok "Database schema is up to date"
    } else {
        Fail "Migrations failed - check DATABASE_URL is correct and the database is reachable."
        Warn "You can retry with: venv\Scripts\Activate.ps1; alembic upgrade head"
    }
}

# -- Done -----------------------------------------------------------------
Write-Host ""
Ok "Setup complete."
Write-Host ""
Write-Host "Next steps:"
if ((Test-Path ".env") -and (Select-String -Path ".env" -Pattern "your-openai-api-key|your_database_url|your-super-secret-jwt" -Quiet -ErrorAction SilentlyContinue)) {
    Write-Host "  1. Fill in the real secrets in .env (OPENAI_API_KEY, DATABASE_URL, JWT_SECRET, ...)"
}
Write-Host "  2. venv\Scripts\Activate.ps1"
Write-Host "  3. uvicorn main:app --reload --port 8000"
Write-Host ""
Write-Host "See DEPLOY.md for production/Cloud Run config, docs/ for architecture notes."
