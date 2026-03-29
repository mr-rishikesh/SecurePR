# DevInsight — Environment Variables & Configuration Guide

> A complete step-by-step guide to configure every environment variable, obtain every credential, and run DevInsight in every environment.

---

## Table of Contents

1. [Quick Start Checklist](#1-quick-start-checklist)
2. [How Environment Variables Work in This Project](#2-how-environment-variables-work-in-this-project)
3. [WEBHOOK\_SECRET](#3-webhook_secret)
4. [GITHUB\_TOKEN](#4-github_token)
5. [GROQ\_API\_KEY](#5-groq_api_key)
6. [UPSTASH\_REDIS\_URL](#6-upstash_redis_url)
7. [Docker Hub Credentials (CI/CD only)](#7-docker-hub-credentials-cicd-only)
8. [Environment-by-Environment Setup](#8-environment-by-environment-setup)
   - [Local Development](#81-local-development)
   - [Docker Compose](#82-docker-compose)
   - [GitHub Actions CI/CD](#83-github-actions-cicd)
   - [Cloud Run / Render / Railway](#84-cloud-run--render--railway)
9. [GitHub Webhook Configuration](#9-github-webhook-configuration)
10. [Local Webhook Tunneling (Smee / Ngrok)](#10-local-webhook-tunneling-smee--ngrok)
11. [Verifying Everything Works](#11-verifying-everything-works)
12. [Troubleshooting](#12-troubleshooting)
13. [Security Best Practices](#13-security-best-practices)
14. [Full Variable Reference Table](#14-full-variable-reference-table)

---

## 1. Quick Start Checklist

Before running DevInsight for the first time, complete every item in this list:

- [ ] Generate a `WEBHOOK_SECRET` (see [§3](#3-webhook_secret))
- [ ] Create a GitHub Personal Access Token → `GITHUB_TOKEN` (see [§4](#4-github_token))
- [ ] Create a Groq API Key → `GROQ_API_KEY` (see [§5](#5-groq_api_key))
- [ ] Set up Redis and get the connection URL → `UPSTASH_REDIS_URL` (see [§6](#6-upstash_redis_url))
- [ ] Copy `.env.example` to `.env.local` and fill in all values (see [§8.1](#81-local-development))
- [ ] Start the stack (`npm run dev` + worker, or `docker compose up`)
- [ ] Set up a tunnel to expose `localhost:3000` (see [§10](#10-local-webhook-tunneling-smee--ngrok))
- [ ] Register the webhook in your GitHub repo settings (see [§9](#9-github-webhook-configuration))
- [ ] Verify with a test PR (see [§11](#11-verifying-everything-works))

---

## 2. How Environment Variables Work in This Project

### File hierarchy

Next.js loads environment files in this order (later files take priority):

```
.env                  ← base defaults, committed to git (no secrets here)
.env.local            ← local overrides, NEVER committed to git
.env.development      ← only loaded when NODE_ENV=development
.env.production       ← only loaded when NODE_ENV=production
.env.development.local
.env.production.local
```

**For this project you only need `.env.local`.** Create it by copying the example:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and fill in real values. The file is already listed in `.gitignore` — it will never accidentally be committed.

### Which variables go where

| Variable | Next.js API (`app/`) | Worker (`lib/worker.ts`) | Notes |
|---|---|---|---|
| `WEBHOOK_SECRET` | ✅ needed | ❌ not needed | Only the webhook route reads it |
| `GITHUB_TOKEN` | ❌ not needed | ✅ needed | Worker fetches diffs and posts comments |
| `GROQ_API_KEY` | ❌ not needed | ✅ needed | Worker calls Groq for AI inference |
| `UPSTASH_REDIS_URL` | ✅ needed | ✅ needed | Both enqueue and dequeue from Redis |

### Client vs server variables

Next.js exposes variables to the browser **only** if they start with `NEXT_PUBLIC_`. All variables in this project are server-only (no `NEXT_PUBLIC_` prefix). They are never sent to the browser.

```
GROQ_API_KEY=...           ← server only ✓ (safe)
NEXT_PUBLIC_APP_NAME=...   ← sent to browser (never put secrets here)
```

---

## 3. WEBHOOK\_SECRET

### What it is

A random string shared between GitHub and your server. GitHub signs every webhook payload with this secret using HMAC-SHA256. Your server verifies the signature to confirm the request genuinely came from GitHub and was not tampered with.

### How to generate it

**Option A — openssl (recommended):**
```bash
openssl rand -hex 32
```
Example output: `a7f3c9d2e1b84f6a0c5d8e2f1a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b`

**Option B — Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option C — Password manager** (1Password, Bitwarden "Generate Password" with 64 hex characters)

> **Rules:**
> - Must be at least 32 characters (256-bit entropy minimum)
> - Use only alphanumeric and common special characters
> - Generate fresh for each environment (dev, staging, production)
> - Never reuse across projects

### Where to put it

`.env.local`:
```
WEBHOOK_SECRET=a7f3c9d2e1b84f6a0c5d8e2f1a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b
```

You will enter this **same value** in GitHub's webhook settings (covered in [§9](#9-github-webhook-configuration)).

---

## 4. GITHUB\_TOKEN

### What it is

A Personal Access Token (PAT) that allows DevInsight to:
1. **Read** Pull Request diffs via `GET /repos/{owner}/{repo}/pulls/{pull_number}` with `Accept: application/vnd.github.diff`
2. **Write** comments on PRs via `POST /repos/{owner}/{repo}/issues/{issue_number}/comments`

### Step-by-step: Create a PAT (Classic)

1. Go to **github.com → top-right avatar → Settings**
2. Scroll to the bottom of the left sidebar → click **Developer settings**
3. Click **Personal access tokens → Tokens (classic)**
4. Click **Generate new token → Generate new token (classic)**
5. Fill in the form:
   - **Note:** `devinsight-pr-auditor` (so you remember what it's for)
   - **Expiration:** 90 days (set a reminder to rotate it)
   - **Scopes:** check the following:

   | Scope | Why it's needed |
   |---|---|
   | `repo` | Read private repo diffs + write issue comments |
   | *(for public repos only)* `public_repo` | Subset of `repo`, smaller blast radius |

6. Click **Generate token**
7. **Copy the token immediately** — GitHub shows it only once

> ⚠️ If you close the page without copying, you must delete and regenerate the token.

### Where to put it

`.env.local`:
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Alternative: Fine-Grained PAT (recommended for production)

Fine-grained PATs let you restrict access to specific repositories and specific permissions — much safer than a classic PAT.

1. Go to **Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set:
   - **Resource owner:** your user or organization
   - **Repository access:** select specific repos you want audited
   - **Permissions:**
     - `Pull requests` → **Read-only** (to fetch diffs)
     - `Issues` → **Read and write** (to post comments)
     - `Contents` → **Read-only** (optional, for file-level context)
4. Generate and copy

Fine-grained tokens look like: `github_pat_xxxxxxxxxxxxxxxxxxxx`

### Alternative: GitHub App (for teams)

If you want to install DevInsight across an entire organization without tying it to a personal account, use a GitHub App. See [ARCHITECTURE.md §16.1](ARCHITECTURE.md) for the setup steps. The `GITHUB_TOKEN` env var would be replaced by `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_INSTALLATION_ID`.

---

## 5. GROQ\_API\_KEY

### What it is

An API key for Groq's inference API. DevInsight sends PR diffs to **Llama 3.3 70B** running on Groq's LPU (Language Processing Unit) hardware and receives security findings in return.

Groq is dramatically faster than traditional GPU inference — typical response times are **1–3 seconds** vs 8–15 seconds on Gemini/GPT-4. This means PR audit comments appear almost immediately after the worker picks up the job.

### Step-by-step: Create an API Key

1. Go to **[console.groq.com](https://console.groq.com)**
   - Sign in with Google, GitHub, or email
2. Click **API Keys** in the left sidebar
3. Click **Create API Key**
4. Give it a name: `devinsight-pr-auditor`
5. Copy the key immediately — it looks like `gsk_xxxxxxxxxxxxxxxxxxxx`

> ⚠️ The key is only shown once. If you close the page without copying, delete it and create a new one.

### Free tier limits (as of 2026)

| Model | Tokens/min | Requests/min | Requests/day | Context |
|---|---|---|---|---|
| `llama-3.3-70b-versatile` | 6,000 | 30 | 1,000 | 128k tokens |
| `llama3-70b-8192` | 6,000 | 30 | 14,400 | 8k tokens |
| `mixtral-8x7b-32768` | 5,000 | 30 | 14,400 | 32k tokens |
| `gemma2-9b-it` | 15,000 | 30 | 14,400 | 8k tokens |

DevInsight uses `llama-3.3-70b-versatile` by default — it has the largest context window (128k tokens) and best security reasoning. To change the model, edit the `GROQ_MODEL` constant in `lib/gemini.ts`.

For a team of 5–20 developers the free tier is typically sufficient. For larger teams, enable a paid plan at **console.groq.com → Billing**.

### Where to put it

`.env.local`:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Changing the model

Open `lib/gemini.ts` and update this line:

```typescript
const GROQ_MODEL = 'llama-3.3-70b-versatile';  // change to any model below
```

Available models on Groq:

| Model ID | Speed | Quality | Best for |
|---|---|---|---|
| `llama-3.3-70b-versatile` | Fast | High | Default — best all-around |
| `llama3-70b-8192` | Fastest | High | Short diffs, lower latency |
| `mixtral-8x7b-32768` | Fast | Good | Large context diffs |
| `gemma2-9b-it` | Very fast | Medium | High-volume, cost-sensitive |

---

## 6. UPSTASH\_REDIS\_URL

### What it is

The connection string for your Redis instance. BullMQ uses Redis to store and manage the job queue. Both the API server (to enqueue jobs) and the worker (to dequeue jobs) need this URL.

### Option A: Local Redis (development)

**Install Redis locally:**

```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# Windows (WSL2 recommended)
wsl --install
# then follow Ubuntu steps above

# Docker (no install needed)
docker run -d -p 6379:6379 redis:alpine
```

**Verify Redis is running:**
```bash
redis-cli ping
# should output: PONG
```

**Your URL:**
```
UPSTASH_REDIS_URL=redis://localhost:6379
```

### Option B: Upstash Redis (serverless, recommended for production)

Upstash is a serverless Redis provider with a generous free tier and zero infrastructure to manage.

**Step-by-step:**

1. Go to **[upstash.com](https://upstash.com)** → Sign up (free)
2. Click **Create Database**
3. Fill in:
   - **Name:** `devinsight`
   - **Type:** Regional (single region) — cheaper
   - **Region:** pick closest to your deployment (e.g., `us-east-1`)
   - **TLS:** ✅ enabled (required for production)
4. Click **Create**
5. On the database page, scroll to **REST API** or **Connection** section
6. Copy the **Redis URL** — it looks like:
   ```
   rediss://default:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@us1-xxxx-xxxx-00000.upstash.io:6379
   ```
   Note `rediss://` (double `s`) — this means TLS is enabled.

**Your URL:**
```
UPSTASH_REDIS_URL=rediss://default:password@host.upstash.io:6379
```

**Free tier limits:**
- 10,000 commands/day
- 256 MB storage
- Sufficient for ~500–1,000 PR audits/day

### Option C: Redis Cloud (Redis Ltd.)

1. Go to **[redis.io/try-free](https://redis.io/try-free)**
2. Create a free account and a free database (30 MB, enough for development)
3. Under **Connect → RedisInsight / redis-cli**, copy the connection string

### Option D: Self-hosted Redis with password

```
UPSTASH_REDIS_URL=redis://:yourpassword@your-server.com:6379
```

Format: `redis://:password@host:port` (note the colon before the password — username is empty for Redis default auth)

### Note about Docker Compose

When running with Docker Compose, the API and worker containers connect to the Redis container using its **service name**, not `localhost`. This is hardcoded in `docker-compose.yml`:

```yaml
environment:
  - UPSTASH_REDIS_URL=redis://redis:6379  # "redis" = Docker Compose service name
```

Your `.env` file's `UPSTASH_REDIS_URL` is only used when running outside Docker (local dev). Docker Compose overrides it with the internal service URL.

---

## 7. Docker Hub Credentials (CI/CD only)

These are only needed if you use the GitHub Actions CI/CD pipeline to push Docker images to Docker Hub. They are **not needed** for local development or Docker Compose.

### DOCKER\_HUB\_USERNAME

Your Docker Hub username. If you don't have an account:
1. Go to **[hub.docker.com](https://hub.docker.com)** → Sign up (free)
2. Your username is shown in the top-right corner after login

### DOCKER\_HUB\_TOKEN

A Docker Hub access token (not your account password).

**Step-by-step:**
1. Log in to Docker Hub
2. Click your avatar → **Account Settings**
3. Navigate to **Security → Access Tokens**
4. Click **New Access Token**
5. Fill in:
   - **Description:** `devinsight-github-actions`
   - **Access permissions:** Read, Write, Delete
6. Click **Generate**
7. Copy the token immediately

### Where to put them (GitHub Actions Secrets)

These are **not** put in `.env` files. They live in GitHub's encrypted secrets store:

1. Go to your GitHub repository
2. Click **Settings → Secrets and variables → Actions**
3. Click **New repository secret** for each:

| Secret name | Value |
|---|---|
| `DOCKER_HUB_USERNAME` | your Docker Hub username |
| `DOCKER_HUB_TOKEN` | the access token you just created |

The GitHub Actions workflow reads them as `${{ secrets.DOCKER_HUB_USERNAME }}`.

---

## 8. Environment-by-Environment Setup

### 8.1 Local Development

This is for running `npm run dev` (Next.js) and the worker separately on your machine.

**Step 1 — Copy the example file:**
```bash
cd c:/Projects/secure-pr
cp .env.example .env.local
```

**Step 2 — Edit `.env.local` with real values:**
```bash
# .env.local

WEBHOOK_SECRET=<paste generated secret>
GITHUB_TOKEN=ghp_<paste your PAT>
GROQ_API_KEY=gsk_<paste your key>
UPSTASH_REDIS_URL=redis://localhost:6379
```

**Step 3 — Start Redis:**
```bash
# if installed locally
redis-server

# or via Docker
docker run -d -p 6379:6379 --name devinsight-redis redis:alpine
```

**Step 4 — Start the Next.js dev server:**
```bash
npm run dev
# → http://localhost:3000
```

**Step 5 — Start the worker in a separate terminal:**
```bash
node --import tsx/esm worker.mjs
```

**Step 6 — Verify both are running:**
```
Terminal 1:  ▲ Next.js 16.2.1 - Local: http://localhost:3000
Terminal 2:  {"level":"info","msg":"PR review worker started","concurrency":3}
```

### 8.2 Docker Compose

This runs all three containers (API, worker, Redis) together. Environment variables are passed from a `.env` file at the project root.

**Step 1 — Create `.env` at the project root** (Docker Compose reads `.env` by default, not `.env.local`):
```bash
cp .env.example .env
```

**Step 2 — Edit `.env`:**
```bash
# .env  (used by Docker Compose — do NOT commit this file)

WEBHOOK_SECRET=<paste generated secret>
GITHUB_TOKEN=ghp_<paste your PAT>
GROQ_API_KEY=gsk_<paste your key>

# Do NOT set UPSTASH_REDIS_URL here — Docker Compose overrides it
# with redis://redis:6379 (the internal service name) automatically
```

**Step 3 — Build and start all containers:**
```bash
docker compose up --build
```

**Step 4 — Verify containers are healthy:**
```bash
docker compose ps
```
Expected output:
```
NAME                  STATUS          PORTS
devinsight-redis      running (healthy)   0.0.0.0:6379->6379/tcp
devinsight-api        running             0.0.0.0:3000->3000/tcp
devinsight-worker     running
```

**Step 5 — Check logs:**
```bash
docker compose logs -f worker   # watch worker logs
docker compose logs -f api      # watch API logs
```

**To stop everything:**
```bash
docker compose down
```

**To stop and delete the Redis volume (wipe all queued jobs):**
```bash
docker compose down -v
```

### 8.3 GitHub Actions CI/CD

The CI/CD pipeline builds Docker images and pushes them to Docker Hub. The runtime secrets (GITHUB\_TOKEN, GEMINI\_API\_KEY, etc.) are injected by your hosting platform at runtime — not by GitHub Actions.

**What GitHub Actions needs:**

| GitHub Secret | Purpose |
|---|---|
| `DOCKER_HUB_USERNAME` | Log in to Docker Hub to push images |
| `DOCKER_HUB_TOKEN` | Docker Hub access token |

**What GitHub Actions does NOT need:**
- `WEBHOOK_SECRET` — not needed at build time
- `GITHUB_TOKEN` — GitHub Actions has its own `GITHUB_TOKEN` automatically, but that's a different token for Actions permissions, not for posting PR comments from your app
- `GROQ_API_KEY` — not needed at build time

**How to add secrets to GitHub:**
1. Repository → **Settings → Secrets and variables → Actions**
2. **New repository secret:**
   - Name: `DOCKER_HUB_USERNAME`, Value: your username
   - Name: `DOCKER_HUB_TOKEN`, Value: the access token

**Triggering the pipeline:**
```bash
git push origin main
# → GitHub Actions runs automatically
# → Check progress at: github.com/{owner}/{repo}/actions
```

### 8.4 Cloud Run / Render / Railway

These platforms let you set environment variables through their dashboard. The variables are injected into the container at startup, exactly like `.env` files but managed securely.

**For Google Cloud Run:**
```bash
gcloud run deploy devinsight-api \
  --image docker.io/yourusername/devinsight-api:latest \
  --set-env-vars WEBHOOK_SECRET=xxx,GITHUB_TOKEN=yyy,GROQ_API_KEY=zzz,UPSTASH_REDIS_URL=rediss://...
```

Or via the Google Cloud Console:
1. Cloud Run → your service → **Edit & Deploy New Revision**
2. Scroll to **Variables & Secrets**
3. Add each variable name and value

**For Render:**
1. Dashboard → your service → **Environment**
2. Click **Add Environment Variable** for each variable

**For Railway:**
1. Project → service → **Variables**
2. Add each key/value pair

> **Important:** When deploying to a cloud platform, `UPSTASH_REDIS_URL` must point to a remote Redis instance (Upstash, Redis Cloud, etc.) — not `localhost`.

---

## 9. GitHub Webhook Configuration

This is how you tell GitHub to send events to your DevInsight instance.

### Step-by-step

1. Navigate to the GitHub repository you want to audit
2. Go to **Settings → Webhooks**
3. Click **Add webhook**
4. Fill in the form:

   **Payload URL:**
   ```
   https://your-domain.com/api/webhook
   ```
   For local development, use your tunnel URL (see [§10](#10-local-webhook-tunneling-smee--ngrok)):
   ```
   https://xxxx-xx-xx-xxx-xx.ngrok-free.app/api/webhook
   ```

   **Content type:** `application/json`

   **Secret:** paste the exact value of your `WEBHOOK_SECRET` environment variable

   **Which events would you like to trigger this webhook?**
   Select **Let me select individual events**, then check:
   - ✅ Pull requests

   Leave everything else unchecked.

   **Active:** ✅ checked

5. Click **Add webhook**

### Verifying the webhook

After saving, GitHub immediately sends a **ping** event. You'll see it in **Recent Deliveries** on the webhook page.

Click the delivery to see:
- **Request**: the ping payload and headers
- **Response**: should show `200` with body `{"ok":true,"message":"pong"}`

A green checkmark means your server received and verified the ping correctly.

### Re-delivering failed webhooks

If a delivery failed (red ✗), you can re-deliver it:
1. Click the delivery in **Recent Deliveries**
2. Click **Redeliver**

Because DevInsight uses the `x-github-delivery` header as the job ID, redeliveries are idempotent — the job only runs once even if delivered multiple times.

---

## 10. Local Webhook Tunneling (Smee / Ngrok)

GitHub needs to reach your `localhost:3000`. Since localhost is not publicly accessible, you need a tunnel.

### Option A: Smee.io (free, no signup)

Smee.io is GitHub's recommended tool for local webhook development.

**Step 1 — Get a Smee channel URL:**
1. Go to **[smee.io](https://smee.io)**
2. Click **Start a new channel**
3. Copy the URL — looks like `https://smee.io/AbCdEfGhIjKlMnOp`

**Step 2 — Install the Smee client:**
```bash
npm install --global smee-client
```

**Step 3 — Start forwarding:**
```bash
smee --url https://smee.io/AbCdEfGhIjKlMnOp --target http://localhost:3000/api/webhook
```

**Step 4 — Use the Smee URL as your GitHub webhook Payload URL:**
```
https://smee.io/AbCdEfGhIjKlMnOp
```

> Smee forwards requests through its server to your local machine. The Smee URL is permanent until you clear it — you can reuse it across development sessions.

### Option B: Ngrok (more features, free tier available)

**Step 1 — Install Ngrok:**
```bash
# macOS
brew install ngrok

# Windows (scoop)
scoop install ngrok

# Or download from ngrok.com/download
```

**Step 2 — Sign up and authenticate** (required for persistent URLs):
```bash
ngrok config add-authtoken YOUR_NGROK_TOKEN
```
Get your token at **[dashboard.ngrok.com](https://dashboard.ngrok.com)** → Your Authtoken.

**Step 3 — Start a tunnel:**
```bash
ngrok http 3000
```

**Step 4 — Copy the forwarding URL:**
```
Forwarding  https://xxxx-xx-xx-xxx-xx.ngrok-free.app → http://localhost:3000
```

Use this URL as your GitHub webhook Payload URL:
```
https://xxxx-xx-xx-xxx-xx.ngrok-free.app/api/webhook
```

> **Important:** On the free Ngrok plan, the URL changes every time you restart Ngrok. You'd need to update the webhook URL in GitHub each time. Upgrade to a paid plan or use Smee for a persistent URL.

### Option C: Cloudflare Tunnel (free, no account needed for quick use)

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Outputs a permanent `*.trycloudflare.com` URL. No signup needed.

---

## 11. Verifying Everything Works

### Verification checklist

**1. Check Redis is connected:**
```bash
# In the worker logs, look for:
{"level":"info","msg":"PR review worker started","concurrency":3,"queue":"pr-review"}

# No "Redis error" messages
```

**2. Check the webhook endpoint responds:**
```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-github-event: ping" \
  -H "x-hub-signature-256: sha256=FAKESIGNATURE" \
  -d '{}'

# Expected: 401 {"error":"Invalid signature"}
# This confirms the endpoint is live and signature checking works
```

**3. Send a real ping via GitHub:**
- Go to your webhook settings → click your webhook
- Scroll to Recent Deliveries → click the ping delivery
- Click **Redeliver**
- Response should be `200 {"ok":true,"message":"pong"}`

**4. Test the full flow with a real PR:**
- Open a new PR (or add a commit to an existing open PR) in the repo where the webhook is configured
- Wait ~10–15 seconds
- Check the PR page — DevInsight should have posted a comment with security findings
- Check worker logs:
```
{"level":"info","msg":"Processing job","pr":"owner/repo#123"}
{"level":"info","msg":"Diff fetched, sending to Gemini","diffChars":1420}
{"level":"info","msg":"Audit comment posted","responseTimeSecs":"8.3"}
```

**5. Check the dashboard:**
- Open `http://localhost:3000/dashboard`
- The page should load without errors (currently shows mock data)

### Test a known vulnerability

To confirm Gemini is finding real issues, add this to a test file in a PR:

```typescript
// test-vuln.ts  ← add this file in a branch, open a PR
const userId = req.params.id;
const query = `SELECT * FROM users WHERE id = ${userId}`;  // SQL injection
const apiKey = "sk-live-abc123def456";  // hardcoded secret
```

DevInsight should comment with at minimum a 🔴 CRITICAL SQL injection finding and a 🟠 HIGH hardcoded secret finding.

---

## 12. Troubleshooting

### "Invalid signature" on all webhooks

**Cause:** `WEBHOOK_SECRET` in your `.env` doesn't match what you entered in GitHub's webhook settings.

**Fix:**
1. Copy the exact value of `WEBHOOK_SECRET` from your `.env.local`
2. Go to GitHub → Settings → Webhooks → your webhook → **Edit**
3. Paste the value into the **Secret** field → **Update webhook**

Make sure there are no leading/trailing spaces.

---

### "GROQ_API_KEY environment variable is not set"

**Cause:** The worker process can't find the env var.

**Fix — local dev:**
- Confirm `.env.local` exists (not just `.env.example`)
- Confirm the key is `GROQ_API_KEY=` (no spaces around `=`)
- Restart the worker after editing `.env.local`

**Fix — Docker:**
- Confirm the variable is in your `.env` file (not `.env.local` — Docker Compose reads `.env`)
- Run `docker compose down && docker compose up --build`

---

### "GITHUB_TOKEN environment variable is not set"

Same as above — check that `GITHUB_TOKEN` is in the correct file for your environment.

Also verify the token hasn't expired:
```bash
curl -H "Authorization: token YOUR_GITHUB_TOKEN" https://api.github.com/user
# Should return your user info, not a 401
```

---

### "connect ECONNREFUSED 127.0.0.1:6379" (Redis connection refused)

**Cause:** Redis is not running.

**Fix — local dev:**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if not running
redis-server
# or
docker start devinsight-redis
# or
docker run -d -p 6379:6379 --name devinsight-redis redis:alpine
```

**Fix — Docker Compose:**
The Redis container may not have started before the API/worker. Check:
```bash
docker compose ps
# Redis should show "running (healthy)"

# If not:
docker compose restart redis
docker compose restart api worker
```

---

### "Error: Request failed with status code 403" (GitHub API)

**Cause:** Your `GITHUB_TOKEN` doesn't have permission to post comments.

**Fix:** Ensure your PAT has the `repo` scope (or `public_repo` for public repos). Regenerate the token with the correct scopes if needed.

---

### Webhook deliveries show "503 Service Unavailable"

**Cause:** Your tunnel (Ngrok/Smee) is not running, or your Next.js server is down.

**Fix:**
1. Confirm `npm run dev` is running
2. Confirm your tunnel is running and the URL matches the webhook Payload URL
3. Test: `curl http://localhost:3000/api/webhook` — should get a 401 (not refused)

---

### Worker processes same PR multiple times

**Cause:** You have multiple worker processes running consuming the same queue.

**This is actually fine** — BullMQ guarantees each job is processed by only one worker. Multiple workers running in parallel increases throughput. If you see duplicate *comments*, check that the `jobId: deliveryId` deduplication is in place in `app/api/webhook/route.ts`.

---

### Jobs are queued but worker never picks them up

**Cause 1:** Worker is connecting to a different Redis instance than the API.

**Fix:** Confirm both API and worker use the exact same `UPSTASH_REDIS_URL`.

**Cause 2:** Worker crashed on startup.

**Fix:** Check worker logs for errors. Common cause: missing env var.

---

### "Error 429: RESOURCE_EXHAUSTED" from Gemini

**Cause:** You've hit Gemini's free tier rate limit (15 requests/minute).

**Fix options:**
1. The built-in retry logic with exponential backoff will handle temporary bursts automatically
2. For sustained high volume, enable billing in Google Cloud Console
3. Reduce worker concurrency from 3 to 1: change `concurrency: 3` in `lib/worker.ts`

---

## 13. Security Best Practices

### Never commit secrets to git

Check that `.gitignore` contains:
```
.env
.env.local
.env.*.local
```

Before your first commit, verify no secrets are tracked:
```bash
git status
# .env.local should NOT appear in the list
```

If you accidentally committed a secret:
1. **Revoke/rotate the secret immediately** (delete and regenerate the token/key — the commit is now public)
2. Remove from git history: `git filter-branch` or `git filter-repo`
3. Force push (after notifying collaborators)

### Rotate secrets regularly

| Secret | Recommended rotation |
|---|---|
| `WEBHOOK_SECRET` | Every 6–12 months, or after a team member leaves |
| `GITHUB_TOKEN` | Set 90-day expiry, rotate on expiry |
| `GROQ_API_KEY` | Every 6–12 months |
| `DOCKER_HUB_TOKEN` | Every 90 days |

### Use a secrets manager in production

Instead of `.env` files on your server, use:

| Platform | Secrets manager |
|---|---|
| AWS | Secrets Manager or Parameter Store |
| GCP | Secret Manager |
| Azure | Key Vault |
| Any | HashiCorp Vault, Doppler, Infisical |

These inject secrets as environment variables at container startup without storing them in files.

### Restrict API key permissions

- **GitHub Token:** Use fine-grained PAT scoped to specific repos + minimum permissions
- **Groq API Key:** Rotate regularly; Groq does not currently support IP restrictions, so treat the key as highly sensitive
- **Docker Hub Token:** Create a separate token per environment (dev, staging, prod)

---

## 14. Full Variable Reference Table

| Variable | Required | Used by | Example value | How to get |
|---|---|---|---|---|
| `WEBHOOK_SECRET` | ✅ Yes | API | `a7f3c9d2e1b84f6a...` | `openssl rand -hex 32` |
| `GITHUB_TOKEN` | ✅ Yes | Worker | `ghp_abc123...` | GitHub → Settings → Developer settings → PAT |
| `GROQ_API_KEY` | ✅ Yes | Worker | `gsk_xxx...` | console.groq.com → API Keys → Create |
| `UPSTASH_REDIS_URL` | ✅ Yes | API + Worker | `redis://localhost:6379` | Local Redis or Upstash dashboard |
| `NODE_ENV` | Auto | API | `production` | Set automatically by Docker/Next.js |
| `PORT` | No | API | `3000` | Default is 3000, change if needed |
| `HOSTNAME` | No | API | `0.0.0.0` | Set in Dockerfile, don't override |
| `DOCKER_HUB_USERNAME` | CI only | GitHub Actions | `yourusername` | Your Docker Hub account name |
| `DOCKER_HUB_TOKEN` | CI only | GitHub Actions | `dckr_pat_xxx...` | Docker Hub → Account Settings → Access Tokens |

### Which file each variable goes in

| Variable | `.env.local` (local dev) | `.env` (Docker Compose) | GitHub Actions Secret |
|---|---|---|---|
| `WEBHOOK_SECRET` | ✅ | ✅ | ❌ |
| `GITHUB_TOKEN` | ✅ | ✅ | ❌ |
| `GROQ_API_KEY` | ✅ | ✅ | ❌ |
| `UPSTASH_REDIS_URL` | ✅ (localhost) | ❌ (overridden by compose) | ❌ |
| `DOCKER_HUB_USERNAME` | ❌ | ❌ | ✅ |
| `DOCKER_HUB_TOKEN` | ❌ | ❌ | ✅ |

---

*DevInsight Configuration Guide · Last updated 2026-03-29*
