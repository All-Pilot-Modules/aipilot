# CI/CD Setup Guide — AI Pilot Backend

## Overview

| What | Where |
|------|-------|
| Frontend | Vercel (auto-deploys, no setup needed) |
| Backend | Google Cloud Run via GitHub Actions |
| GCP Project | `brockport-acm-sigai-project` |
| Cloud Run Service | `ai-pilot-backend` |
| Region | `us-central1` |

---

## How the Pipeline Works

Push any change to `Backend/` on `main` branch → GitHub Actions automatically:
1. Builds Docker image
2. Pushes to Google Container Registry (GCR)
3. Deploys new image to Cloud Run

---

## One-Time Setup

### Step 1 — Get GCP Project ID

Already done. The Project ID is:
```
brockport-acm-sigai-project
```

Add this as a GitHub Secret:
- Go to GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
- Name: `GCP_PROJECT_ID`
- Value: `brockport-acm-sigai-project`

---

### Step 2 — Required GCP Permissions (get these first)

Before you can create the service account, your GCP account needs permission to do so.
Ask the org admin (whoever owns the Brockport ACM SIGAI Project) to grant your account:

| Permission Needed | Why |
|-------------------|-----|
| `roles/iam.serviceAccountAdmin` | To create service accounts |
| `roles/resourcemanager.projectIamAdmin` | To assign roles to the service account |
| `roles/run.admin` | To deploy to Cloud Run |
| `roles/storage.admin` | To push images to Container Registry |
| `roles/secretmanager.admin` | To allow the SA to read secrets |

Or ask them to grant you: **`roles/owner`** on the project (simplest if this is your org's project).

---

### Step 3 — Create the Service Account

Once you have permissions:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Make sure project `brockport-acm-sigai-project` is selected
3. **IAM & Admin → Service Accounts → + Create Service Account**
4. Fill in:
   - **Name**: `github-deploy`
   - **Service account ID**: `github-deploy` (auto-filled)
5. Click **Create and Continue**
6. Add these 4 roles one by one:
   - `Cloud Run Admin`
   - `Storage Admin`
   - `Service Account User`
   - `Secret Manager Secret Accessor`
7. Click **Continue → Done**

---

### Step 4 — Download the JSON Key

1. In the Service Accounts list, find `github-deploy@brockport-acm-sigai-project.iam.gserviceaccount.com`
2. Click **⋮ (three dots) → Manage keys**
3. **Add Key → Create new key → JSON → Create**
4. A `.json` file downloads to your computer
5. Open it → Select All → Copy the entire contents

---

### Step 5 — Add JSON Key as GitHub Secret

1. Go to GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `GCP_SERVICE_ACCOUNT_KEY`
4. Value: paste the entire JSON you copied
5. Click **Add secret**

---

## Files Changed / Created

| File | What It Does |
|------|-------------|
| `.github/workflows/backend.yml` | Main deploy workflow — triggers on push to `Backend/` |
| `.github/workflows/ci.yml` | PR check — lints and validates Docker build |
| `Backend/Dockerfile` | Updated to use gunicorn (4 workers instead of 1) |
| `cloudbuild.yaml` | Manual Cloud Run deploy reference (kept as backup) |

---

## Cloud Run Settings Applied

These are set automatically by the deploy workflow:

| Setting | Value | Why |
|---------|-------|-----|
| `--min-instances=1` | Always 1 warm instance | No cold starts when class begins |
| `--cpu=4` | 4 vCPUs | Matches 4 gunicorn workers |
| `--memory=4Gi` | 4 GB RAM | Handles AI workloads + doc processing |
| `--cpu-boost` | Faster startup | Quicker scale-up under load |
| `--max-instances=10` | Up to 10 replicas | Handles class-size traffic spikes |
| `--concurrency=200` | 200 requests/instance | High throughput per container |
| `--timeout=300` | 5 min request timeout | Long AI feedback calls don't get cut off |

---

## Secrets in Cloud Run (already set in GCP Secret Manager)

These are read by Cloud Run at runtime — not stored in the repo:

| Secret Name in GCP | Env Var in App |
|--------------------|----------------|
| `openai-api-key` | `OPENAI_API_KEY` |
| `database-url` | `DATABASE_URL` |
| `jwt-secret` | `JWT_SECRET` |
| `supabase-url` | `SUPABASE_URL` |
| `supabase-service-key` | `SUPABASE_SERVICE_KEY` |
| `clerk-secret-key` | `CLERK_SECRET_KEY` |
| `frontend-url` | `FRONTEND_URL` |
| `email-username` | `EMAIL_USERNAME` |
| `email-password` | `EMAIL_PASSWORD` |

> If you add a new env var, add it to both GCP Secret Manager AND the `--set-secrets` list in `.github/workflows/backend.yml`.

---

## After Setup — What to Expect

| Trigger | Result |
|---------|--------|
| Push to `main` with `Backend/` changes | Auto deploy to Cloud Run (~3-5 min) |
| Push to `main` with only `Frontend/` changes | Vercel handles it, backend untouched |
| Open a PR with `Backend/` changes | CI runs lint + Docker build check |
| Push to `main` with no `Backend/` changes | Nothing runs |

---

## Resuming Setup

**Where we left off:** Need org permissions granted before creating the service account.

Next steps once permissions are sorted:
1. Create service account (Step 3 above)
2. Download JSON key (Step 4)
3. Add both secrets to GitHub (Steps 1 and 5)
4. Push any small change to `Backend/` to test the first deploy
