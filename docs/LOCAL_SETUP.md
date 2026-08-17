# Local Setup Guide — Full Functional DevInsight

This guide walks you through running DevInsight completely locally with all components working together: webhook receiver, job queue, background worker, and dashboard.

## Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org))
- **Redis** (we'll use Docker, but you can install locally)
- **Docker & Docker Compose** (optional, for Redis)
- **Git** for cloning/testing
- **A GitHub account** with a test repository

## Step 1: Set up the project

```bash
cd c:/Projects/secure-pr
npm install
```

This installs all dependencies: Next.js, BullMQ, Groq SDK, Octokit, etc.

## Step 2: Start Redis

### Option A: Docker Compose (recommended)

```bash
docker compose up redis
```

This starts the Redis container on `localhost:6379`. Leave it running in a terminal.

### Option B: Local Redis installation

If you have Redis installed locally:

```bash
redis-server
```

## Step 3: Get API credentials

You'll need three pieces of information:

### 1. **Groq API Key**

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create or copy your API key
5. Keep it safe — you'll use it in `.env`

### 2. **GitHub Personal Access Token**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name it `devinsight-local`
4. Select these scopes:
   - ✅ `repo` (full control of private repositories)
   - ✅ `workflow` (to manage Actions)
5. Click **Generate token**
6. **Copy immediately** — you won't see it again

### 3. **Webhook Secret**

Generate a random secret for signing webhooks. You can use:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This outputs something like: `a1b2c3d4e5f6...`

## Step 4: Create `.env` file

Create a `.env.local` file in the project root:

```bash
cat > .env.local << 'EOF'
# GitHub Webhook Secret (from Step 3)
WEBHOOK_SECRET=your_random_secret_here

# GitHub Personal Access Token (from Step 3)
GITHUB_TOKEN=ghp_your_token_here

# Groq API Key (from Step 3)
GROQ_API_KEY=gsk_your_groq_key_here

# Redis URL (local development)
UPSTASH_REDIS_URL=redis://localhost:6379
EOF
```

Replace:
- `your_random_secret_here` → the webhook secret from Step 3
- `ghp_your_token_here` → your GitHub token from Step 3
- `gsk_your_groq_key_here` → your Groq API key from Step 3

Verify the file:

```bash
cat .env.local
```

## Step 5: Start the Next.js API server

In a **new terminal** (keep Redis running):

```bash
npm run dev
```

You should see:

```
> next dev

  ▲ Next.js 16.2.1
  - Local:        http://localhost:3000
  - Environments: .env.local

Ready in 1.2s
```

Test it by opening [http://localhost:3000](http://localhost:3000) — you should see the DevInsight landing page.

### Verify the webhook endpoint

The webhook is available at `http://localhost:3000/api/webhook` — we'll test it later.

## Step 6: Start the background worker

In a **third terminal** (keep Redis and API running):

```bash
node --import tsx/esm worker.mjs
```

You should see:

```
{"ts":"2025-04-16T10:30:45.123Z","level":"info","msg":"PR review worker started","concurrency":3,"queue":"pr-review"}
```

This means the worker is listening for jobs from the queue.

## Step 7: Test locally with ngrok (without GitHub)

Before setting up a real GitHub webhook, let's test the full flow locally using `ngrok` to expose your local server to the internet.

### Install ngrok

Download from [ngrok.com](https://ngrok.com/download) or use Homebrew:

```bash
brew install ngrok  # macOS
# or download the binary for Windows
```

### Expose your local API

In a **fourth terminal**:

```bash
ngrok http 3000
```

You should see:

```
Session Status                online
Account                       <your-email>
Version                       3.x.x
Region                        us-california
Latency                       25ms
Web Interface                 http://127.0.0.1:4040

Forwarding                    https://abc123def.ngrok.io -> http://localhost:3000
```

**Copy the `https://abc123def.ngrok.io` URL** — this is your public webhook endpoint.

### Test the webhook manually

In a **fifth terminal**, send a test PR event:

```bash
# Generate a test payload
PAYLOAD='{"action":"opened","pull_request":{"number":42,"head":{"sha":"abc1234567890def"},"title":"Test PR"},"repository":{"owner":{"login":"testuser"},"name":"testrepo"}}'

# Calculate HMAC signature
SIGNATURE=$(node -e "
const crypto = require('crypto');
const payload = '$PAYLOAD';
const secret = process.env.WEBHOOK_SECRET;
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
console.log('sha256=' + hmac.digest('hex'));
")

# Send the webhook
curl -X POST https://abc123def.ngrok.io/api/webhook \
  -H 'Content-Type: application/json' \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H 'X-GitHub-Event: pull_request' \
  -H 'X-GitHub-Delivery: test-delivery-123' \
  -d "$PAYLOAD"
```

### Monitor the worker

Check the **worker terminal** — you should see:

```
{"ts":"2025-04-16T10:35:22.451Z","level":"info","msg":"Processing job","jobId":"test-delivery-123","pr":"testuser/testrepo#42",...}
```

Then it will attempt to fetch the PR diff from GitHub. Since this is a fake PR, it will fail, but you'll see the attempt logged.

**Success** — the webhook reached the queue and the worker picked it up!

## Step 8: Set up a real GitHub webhook

Now let's use a real repository so the full flow works end-to-end.

### Choose a test repo

Create a test GitHub repository (or use an existing one you own):

1. Go to [github.com/new](https://github.com/new)
2. Name it `devinsight-test` (or similar)
3. Click **Create repository**

### Add the webhook

1. Go to your repo → **Settings → Webhooks → Add webhook**
2. Set **Payload URL** to your ngrok URL + webhook path:
   ```
   https://abc123def.ngrok.io/api/webhook
   ```
3. Set **Content type** to `application/json`
4. Set **Secret** to the value in your `.env.local` `WEBHOOK_SECRET` (not the ngrok secret)
5. Select **Let me select individual events** and check:
   - ✅ **Pull requests**
6. Keep **Active** checked
7. Click **Add webhook**

### Create a test pull request

1. Clone your test repo
2. Create a new branch:
   ```bash
   git checkout -b test-security-pr
   ```
3. Add a file with a vulnerability (for testing):
   ```bash
   cat > test.js << 'EOF'
   // Example: hardcoded secret (DevInsight should flag this)
   const API_KEY = "sk_live_1234567890abcdef";
   
   // Example: SQL injection (DevInsight should flag this)
   const query = `SELECT * FROM users WHERE id = ${userId}`;
   EOF
   ```
4. Commit and push:
   ```bash
   git add test.js
   git commit -m "Add test file"
   git push origin test-security-pr
   ```
5. Open a PR on GitHub

### Watch the webhook fire

1. In the **ngrok web interface** ([http://127.0.0.1:4040](http://127.0.0.1:4040)), you should see the webhook request
2. Check the **API terminal** (`npm run dev`) for logs
3. Check the **worker terminal** (`node --import tsx/esm worker.mjs`) — you should see:
   ```
   {"ts":"...","level":"info","msg":"Processing job","pr":"youruser/devinsight-test#1",...}
   {"ts":"...","level":"info","msg":"Diff fetched, sending to Groq",...}
   ```
4. Within 10–20 seconds, a comment should appear on your PR with security findings

**Success** — DevInsight is running fully locally!

## Step 9: View the analytics dashboard

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to see the mock analytics dashboard. (This uses hardcoded mock data for now — live data integration requires a database.)

## Stopping everything

To shut down all services:

1. Press **Ctrl+C** in the **worker terminal**
2. Press **Ctrl+C** in the **API terminal**
3. Press **Ctrl+C** in the **ngrok terminal**
4. Press **Ctrl+C** in the **Redis terminal** (or `docker compose down`)

## Troubleshooting

### "Redis connection failed"

**Problem:** Worker or API can't connect to Redis.

**Fix:**
- Ensure Redis is running: `docker compose up redis` or `redis-server`
- Check `UPSTASH_REDIS_URL=redis://localhost:6379` in `.env.local`
- Try restarting: `docker compose restart redis`

### "GROQ_API_KEY is not set"

**Problem:** Groq audits fail or worker logs show missing key.

**Fix:**
- Verify `.env.local` contains `GROQ_API_KEY=gsk_...`
- Restart the worker: `node --import tsx/esm worker.mjs`
- Check the API key is valid at [console.groq.com/keys](https://console.groq.com/keys)

### "Invalid signature" / webhook rejected

**Problem:** Webhook POST returns 401.

**Fix:**
- Ensure the `WEBHOOK_SECRET` in `.env.local` matches the secret in GitHub webhook settings
- Check the signature was calculated with the same secret in manual tests

### "Empty diff — skipping"

**Problem:** Worker processes the job but finds no diff.

**Cause:** This happens with the fake test payload (Step 7) — it's expected.

**Fix:** Use a real GitHub repo and real PR (Step 8).

### "Job stalled" or "Job failed"

**Problem:** Worker logs show job failures or stalls.

**Fix:**
- Ensure the GitHub token has `repo:read` and `issues:write` scopes
- Verify `GITHUB_TOKEN=ghp_...` in `.env.local`
- Check the PR exists and is publicly accessible
- Increase retry limit in `lib/queue.ts` if needed

### ngrok keeps disconnecting

**Problem:** Webhook stops working after a while.

**Fix:**
- ngrok's free tier disconnects after 2 hours
- Keep the ngrok terminal open and running
- For long-running setups, consider paid ngrok or deploying to a server

## Advanced: Run with Docker Compose

To run all three services (Redis, API, Worker) together:

1. Ensure `.env.local` exists (Step 4)
2. Run:
   ```bash
   docker compose up --build
   ```

This starts:
- `devinsight-redis` on `localhost:6379`
- `devinsight-api` on `localhost:3000`
- `devinsight-worker` (background)

All logs are visible in the Docker output. Stop with `Ctrl+C` or `docker compose down`.

## Next steps

- **Customize the audit prompt** in `lib/gemini.ts` to flag different vulnerability classes
- **Add database persistence** to store audit results instead of just posting comments
- **Integrate with Slack** to notify teams of critical findings
- **Deploy to production** using the Docker images and GitHub Actions pipeline

---

**Questions?** Check the main [README.md](README.md) or inspect the code in `app/api/webhook/route.ts` and `lib/worker.ts`.
