# SecurePR — AI-Powered PR Security Auditor

SecurePR hooks into GitHub via webhooks, audits each pull request diff with an LLM, and posts severity-rated security findings directly on the PR thread — automatically.

## How it works

1. **Webhook fires** — GitHub sends a `pull_request` event to `/api/webhook`. The HMAC-SHA256 signature is verified and a job is enqueued in under 50ms, so GitHub never times out.
2. **Queue** — Jobs land in a BullMQ queue backed by Redis with 3 auto-retries and exponential backoff.
3. **Worker audits the diff** — A background worker fetches only the changed lines via the GitHub API and sends them to Groq (llama-3.3-70b-versatile) for analysis.
4. **Comment posted** — Findings are posted directly on the PR thread, severity-rated with actionable remediation steps.

### Threat classes detected

| Class | Examples |
|---|---|
| SQL Injection | Unparameterized queries, string interpolation in SQL |
| Hardcoded Secrets | API keys, passwords, tokens in source code |
| Insecure Dependencies | Known-vulnerable packages, outdated CVEs |
| XSS | Unsanitized user input rendered in HTML/JS |
| Path Traversal | User-controlled file paths without sanitization |
| Broken Authentication | Missing auth checks, weak token validation |
| Sensitive Data Exposure | Logging PII or stack traces to clients |

## Project structure

```
app/
  api/webhook/route.ts   # GitHub webhook handler
  dashboard/page.tsx     # Analytics dashboard
  page.tsx               # Landing page
lib/
  gemini.ts              # Groq API client + audit logic
  queue.ts               # BullMQ queue + Redis connection
  worker.ts              # Background job processor
worker.mjs               # Standalone worker entry point (Docker)
Dockerfile               # Next.js API image
worker.Dockerfile        # Worker image
docker-compose.yml       # Redis + API + Worker services
```

## Local development

### Prerequisites

- Node.js 20+
- Redis (or use Docker Compose)

### Setup

```bash
npm install
cp .env.example .env
# Fill in your credentials in .env
```

### Environment variables

| Variable | Description |
|---|---|
| `WEBHOOK_SECRET` | Secret configured in GitHub repo's webhook settings |
| `GITHUB_TOKEN` | Personal access token with `repo:read` and `issues:write` |
| `GROQ_API_KEY` | API key from [console.groq.com/keys](https://console.groq.com/keys) |
| `UPSTASH_REDIS_URL` | Redis URL — use `redis://localhost:6379` for local dev |

### Run

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — Background worker
node --import tsx/esm worker.mjs
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page and [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the analytics dashboard.

## Docker

```bash
# Start Redis + API + Worker
docker compose up --build
```

The API is available at `http://localhost:3000`.

## GitHub webhook setup

1. Go to your repo → **Settings → Webhooks → Add webhook**
2. Set **Payload URL** to `https://your-domain.com/api/webhook`
3. Set **Content type** to `application/json`
4. Generate a secret and set it as `WEBHOOK_SECRET` in your environment
5. Select **Pull request** events (or "Send me everything")

## CI/CD

Pushing to `main` triggers a GitHub Actions workflow that builds and pushes Docker images for both the API and worker to Docker Hub. Set the following repository secrets:

- `DOCKER_HUB_USERNAME`
- `DOCKER_HUB_TOKEN`

## Tech stack

- [Next.js 16](https://nextjs.org) — API routes + frontend + Backend
- [BullMQ](https://bullmq.io) — Job queue with retries and concurrency control
- [Groq SDK](https://console.groq.com) — Fast LLM inference (llama-3.3-70b-versatile)
- [Octokit](https://github.com/octokit/rest.js) — GitHub API client
- [ioredis](https://github.com/redis/ioredis) — Redis client
- [Recharts](https://recharts.org) — Dashboard charts
- [Tailwind CSS v4](https://tailwindcss.com) — Styling
