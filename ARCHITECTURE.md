# DevInsight — Complete Architecture & Technical Reference

> A deep-dive into how every part of this system works, why each decision was made, what alternatives exist, and how to extend it.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Request Lifecycle — Step by Step](#3-request-lifecycle--step-by-step)
4. [GitHub Webhook Layer](#4-github-webhook-layer)
5. [Message Queue — BullMQ & Redis](#5-message-queue--bullmq--redis)
6. [Background Worker](#6-background-worker)
7. [AI Layer — Gemini 1.5 Flash](#7-ai-layer--gemini-15-flash)
8. [GitHub API Integration — Octokit](#8-github-api-integration--octokit)
9. [Frontend — Next.js App Router](#9-frontend--nextjs-app-router)
10. [Containerization — Docker](#10-containerization--docker)
11. [CI/CD — GitHub Actions](#11-cicd--github-actions)
12. [Security Design](#12-security-design)
13. [Reliability Patterns](#13-reliability-patterns)
14. [Environment Variables Reference](#14-environment-variables-reference)
15. [Alternatives for Every Component](#15-alternatives-for-every-component)
16. [Future Enhancements](#16-future-enhancements)
17. [Glossary](#17-glossary)

---

## 1. Project Overview

**DevInsight** is a distributed system that automatically audits every GitHub Pull Request for security vulnerabilities using AI. When a developer opens or updates a PR, DevInsight:

1. Receives a webhook from GitHub
2. Verifies the request is genuinely from GitHub (HMAC-SHA256)
3. Queues the audit job in Redis
4. Replies to GitHub in milliseconds (so the webhook never times out)
5. A background worker fetches only the changed lines (the "diff")
6. Sends the diff to Google Gemini 1.5 Flash with a security-auditor system prompt
7. Posts the findings as a comment directly on the PR

The key architectural insight is **separating the webhook receiver from the actual work**. This is what makes the system reliable under load.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub                               │
│   Developer opens PR  →  GitHub fires webhook POST          │
└─────────────────────────────┬───────────────────────────────┘
                              │  HTTPS POST /api/webhook
                              │  x-hub-signature-256: sha256=...
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API (Container: devinsight-api)        │
│                                                             │
│  1. Verify HMAC-SHA256 signature                            │
│  2. Parse pull_request event                                │
│  3. Add job to BullMQ queue                                 │
│  4. Return 200 OK  ←── happens in < 50ms                   │
└─────────────────────────────┬───────────────────────────────┘
                              │  Redis LPUSH
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Redis (Container: devinsight-redis)            │
│                                                             │
│  Queue: "pr-review"                                         │
│  [ job1, job2, job3, ... ]  ←── persisted to disk          │
└─────────────────────────────┬───────────────────────────────┘
                              │  BullMQ BRPOP (blocking pop)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           BullMQ Worker (Container: devinsight-worker)      │
│                                                             │
│  1. Fetch PR diff  →  GitHub API (Octokit)                  │
│  2. Truncate diff to 50k chars                              │
│  3. Send to Gemini 1.5 Flash                                │
│  4. Post audit comment  →  GitHub API (Octokit)             │
└─────────────────────────────────────────────────────────────┘
```

### Why Three Separate Containers?

| Container | Responsibility | Scales independently |
|---|---|---|
| `devinsight-api` | Receive webhooks, serve dashboard | Yes — add more instances behind a load balancer |
| `devinsight-redis` | Queue persistence, job state | Yes — use Redis Cluster for scale |
| `devinsight-worker` | CPU/IO-heavy AI processing | Yes — run multiple worker replicas |

If everything was in one process, a slow Gemini response would hold up the webhook receiver, causing GitHub to retry (and retry, and retry).

---

## 3. Request Lifecycle — Step by Step

Here is the full journey of a single Pull Request audit, from code push to comment on GitHub.

```
Developer           GitHub              DevInsight API      Redis           Worker          Gemini          GitHub API
    │                  │                      │               │               │               │               │
    │── git push ──►   │                      │               │               │               │               │
    │                  │── webhook POST ──►   │               │               │               │               │
    │                  │   (< 10s timeout)    │               │               │               │               │
    │                  │                      │─ verify HMAC  │               │               │               │
    │                  │                      │─ parse JSON   │               │               │               │
    │                  │                      │─ LPUSH job ──►│               │               │               │
    │                  │◄── 200 OK ──────────│               │               │               │               │
    │                  │   (< 50ms!)          │               │               │               │               │
    │                  │                      │               │◄─ BRPOP job ──│               │               │
    │                  │                      │               │               │─ GET /diff ──────────────────►│
    │                  │                      │               │               │◄─ unified diff ───────────────│
    │                  │                      │               │               │─ generateContent() ──────────►│
    │                  │                      │               │               │◄─ security findings ──────────│
    │                  │                      │               │               │─ createComment() ────────────►│
    │                  │                      │               │               │◄─ comment URL ────────────────│
    │◄── PR comment ───────────────────────────────────────────────────────────────────────────────────────  │
```

**Why this matters:** GitHub has a **10-second timeout** on webhook delivery. If your endpoint doesn't respond in time, GitHub marks the delivery as failed and retries. By queuing immediately and responding with 200 OK, the webhook receiver always finishes in < 50ms regardless of how long Gemini takes.

---

## 4. GitHub Webhook Layer

### File: `app/api/webhook/route.ts`

This is a **Next.js App Router Route Handler** — a serverless function that runs on every incoming POST to `/api/webhook`.

#### 4.1 HMAC-SHA256 Signature Verification

When you create a webhook in GitHub, you provide a **Webhook Secret**. GitHub uses this secret to compute an HMAC-SHA256 hash of the raw request body and sends it in the `x-hub-signature-256` header.

```
x-hub-signature-256: sha256=abc123def456...
```

**How verification works:**

```typescript
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');             // hash the raw body with the secret
  const digest = `sha256=${hmac.digest('hex')}`;  // produce our own hash

  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;  // guard before timingSafeEqual
  return crypto.timingSafeEqual(a, b);      // constant-time comparison
}
```

**Why `timingSafeEqual` instead of `===`?**

Normal string comparison (`===`) short-circuits — it stops as soon as it finds a mismatch. This means an attacker can measure the response time to guess characters one by one (a **timing attack**). `crypto.timingSafeEqual` always takes the same amount of time regardless of where strings differ.

**Why check buffer length before `timingSafeEqual`?**

`timingSafeEqual` throws if the two buffers have different lengths. The length check prevents that crash and avoids leaking timing information about length differences.

#### 4.2 Event Filtering

GitHub sends webhooks for dozens of event types. We only care about `pull_request` events, and within those, only three actions:

```typescript
const HANDLED_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);
```

| Action | When it fires |
|---|---|
| `opened` | A new PR is created |
| `synchronize` | New commits are pushed to an existing PR |
| `reopened` | A closed PR is reopened |

Actions we intentionally ignore: `closed`, `merged`, `labeled`, `assigned`, `review_requested`, etc.

#### 4.3 Idempotent Job Enqueue

```typescript
await prReviewQueue.add('review-pr', jobData, { jobId: deliveryId });
```

GitHub sends a unique `x-github-delivery` header with every webhook delivery. We use this as the **BullMQ job ID**. If GitHub retries the same delivery (because of a network blip), BullMQ sees the same jobId already exists and silently skips it. **No duplicate audits.**

#### 4.4 The `ping` Event

When you first save a webhook in GitHub's UI, it sends a `ping` event to verify your endpoint is alive. Without handling it, GitHub shows a red ✗ even though your webhook is correctly set up.

```typescript
if (event === 'ping') {
  return NextResponse.json({ ok: true, message: 'pong' }, { status: 200 });
}
```

---

## 5. Message Queue — BullMQ & Redis

### Files: `lib/queue.ts`, `worker.mjs`

#### 5.1 Why a Queue at All?

Without a queue:

```
GitHub webhook → [call Gemini directly] → post comment → return 200
     ↑
     This takes 8–15 seconds. GitHub times out at 10 seconds. ✗
```

With a queue:

```
GitHub webhook → enqueue job → return 200 OK   ← < 50ms ✓
                                     ↓
                              Worker picks up job
                              (takes as long as needed) ✓
```

The queue also provides **durability**: if your worker crashes mid-job, Redis still has the job and it will be retried when the worker restarts.

#### 5.2 How BullMQ Works Internally

BullMQ uses Redis data structures:

| Redis Key | Type | Purpose |
|---|---|---|
| `bull:pr-review:wait` | List | Jobs waiting to be picked up |
| `bull:pr-review:active` | Sorted Set | Jobs currently being processed |
| `bull:pr-review:completed` | Sorted Set | Finished jobs (kept for `count: 200`) |
| `bull:pr-review:failed` | Sorted Set | Failed jobs (kept for `count: 100`) |
| `bull:pr-review:delayed` | Sorted Set | Jobs scheduled for future execution |
| `bull:pr-review:{jobId}` | Hash | Job data, progress, timestamps |

When a worker calls `BRPOP` on the wait list, Redis atomically moves the job to the active set. If the worker crashes without completing, a **stall detection** mechanism moves it back to wait after a timeout.

#### 5.3 Default Job Options

```typescript
defaultJobOptions: {
  attempts: 3,                              // retry up to 3 times total
  backoff: { type: 'exponential', delay: 5000 },  // 5s, 10s, 20s between retries
  removeOnComplete: { count: 200 },         // keep last 200 completed jobs
  removeOnFail: { count: 100 },            // keep last 100 failed jobs for debugging
},
```

**Exponential backoff** means if Gemini is temporarily overloaded, we don't hammer it. We wait 5 seconds, then 10, then 20. This is the standard pattern used by AWS SQS, Google Pub/Sub, and every production queue system.

**`removeOnComplete`** prevents Redis memory from growing unboundedly. Without it, every completed job stays in Redis forever.

#### 5.4 Redis Connection Configuration

```typescript
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,   // required by BullMQ — don't limit retries per command
  enableReadyCheck: false,      // required for Upstash — Upstash doesn't support READY check
  retryStrategy: (times) => Math.min(times * 500, 5000),  // reconnect with backoff
});
```

**`maxRetriesPerRequest: null`** is a BullMQ requirement. By default ioredis will fail a command after 3 retries. BullMQ needs it to be unlimited so it can handle Redis restarts gracefully.

**`enableReadyCheck: false`** is needed for Upstash Redis (serverless Redis). Upstash doesn't implement the `DEBUG SLEEP` command that ioredis's ready check uses.

**`retryStrategy`** implements reconnection with capped backoff: waits 500ms, 1000ms, 1500ms... up to a max of 5000ms between reconnect attempts. Without this, a Redis restart would crash the entire app.

#### 5.5 Worker Concurrency & Rate Limiting

```typescript
const worker = new Worker('pr-review', processJob, {
  concurrency: 3,                              // process 3 jobs simultaneously
  limiter: { max: 10, duration: 60_000 },      // max 10 jobs per minute
});
```

**Concurrency 3** means the worker runs up to 3 PR audits in parallel. Since each audit involves I/O (GitHub API + Gemini API) and not CPU work, parallelism is safe and efficient.

**Rate limiter** prevents overwhelming the Gemini API or GitHub API with bursts of requests. If 50 PRs are opened simultaneously, BullMQ will process them 10 per minute instead of all at once.

---

## 6. Background Worker

### Files: `lib/worker.ts`, `worker.mjs`

#### 6.1 The Worker Entry Point (`worker.mjs`)

```javascript
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('tsx/esm', pathToFileURL('./'));  // teach Node.js to understand TypeScript
const { startWorker } = await import('./lib/worker.ts');
```

`worker.mjs` is a plain JavaScript ESM file (`.mjs` = ES Module). It uses **tsx** to register a TypeScript loader with Node's module system, then imports the TypeScript worker code directly. This means we don't need a separate TypeScript compilation step for the worker in development.

**Why not just compile TypeScript first?** Compilation works fine for production, but during development you'd need to recompile after every change. tsx lets Node understand TypeScript natively.

#### 6.2 Graceful Shutdown

```javascript
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

async function shutdown(signal) {
  await worker.close();  // wait for active jobs to finish
  process.exit(0);
}
```

**SIGTERM** is sent by Docker/Kubernetes when stopping a container (e.g., during a deployment). **SIGINT** is sent when you press Ctrl+C.

`worker.close()` tells BullMQ to:
1. Stop picking up new jobs
2. Wait for currently active jobs to complete
3. Release the Redis connection

Without graceful shutdown, in-progress jobs would be orphaned in the "active" state and require manual intervention or a stall timeout to recover.

#### 6.3 The `processJob` Function

```typescript
async function processJob(job: Job<PRJobData>): Promise<void> {
  await job.updateProgress(10);  // progress tracking: 10%

  const diff = await fetchPRDiff(owner, repo, prNumber);
  await job.updateProgress(40);  // 40%

  const auditResult = await auditDiff(diff);
  await job.updateProgress(80);  // 80%

  await postPRComment(owner, repo, prNumber, comment);
  await job.updateProgress(100); // done
}
```

Progress updates are stored in Redis and can be read by the API or a dashboard to show real-time job status.

#### 6.4 Singleton Pattern for Octokit

```typescript
let _octokit: Octokit | null = null;
function getOctokit(): Octokit {
  if (!_octokit) {
    _octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return _octokit;
}
```

Creating an Octokit instance is cheap, but the pattern matters for two reasons:
1. **Connection pooling**: Octokit uses Node's `https` module under the hood, which maintains a connection pool. A singleton reuses these connections.
2. **Consistency**: If you ever switch to GitHub App authentication (JWT tokens that expire), you replace one place, not N places.

#### 6.5 Structured JSON Logging

```typescript
function log(level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, msg, ...meta };
  (level === 'error' ? console.error : console.log)(JSON.stringify(entry));
}
```

All logs are emitted as **JSON lines** (one JSON object per line). This is the standard format for production logging because:
- Log aggregators (Datadog, CloudWatch, Loki) can parse fields automatically
- You can query by `level`, `jobId`, `pr`, etc. without regex
- Timestamps are ISO 8601 with millisecond precision

Example output:
```json
{"ts":"2026-03-29T10:23:11.045Z","level":"info","msg":"Processing job","jobId":"abc123","pr":"acme/api#142","sha":"a3f9b12","attempt":1}
{"ts":"2026-03-29T10:23:11.890Z","level":"info","msg":"Diff fetched, sending to Gemini","pr":"acme/api#142","diffChars":3420}
{"ts":"2026-03-29T10:23:19.201Z","level":"info","msg":"Audit comment posted","pr":"acme/api#142","responseTimeSecs":"8.2"}
```

---

## 7. AI Layer — Gemini 1.5 Flash

### File: `lib/gemini.ts`

#### 7.1 Why Gemini 1.5 Flash?

| Model | Speed | Context Window | Cost | Best for |
|---|---|---|---|---|
| Gemini 1.5 Flash | ~2–4s | 1M tokens | Very low | High-volume automation |
| Gemini 1.5 Pro | ~5–15s | 1M tokens | Medium | Complex reasoning |
| GPT-4o | ~5–10s | 128k tokens | Higher | General purpose |
| Claude 3 Haiku | ~1–3s | 200k tokens | Very low | Speed-critical tasks |

Flash is chosen because:
- **Speed**: PR audits should complete in < 15 seconds total
- **Cost**: You may audit hundreds of PRs per day; cost matters
- **1M token context**: Even large monorepo diffs fit in one call

#### 7.2 The System Prompt

The system prompt is what transforms a general LLM into a specialized security auditor. It does three things:

1. **Assigns a role**: `"You are a strict security auditor"` — this primes the model to approach the task with domain expertise
2. **Constrains scope**: `"reviewing a GitHub Pull Request diff"` and `"do not flag code outside the diff"` — prevents hallucination about code not in the diff
3. **Defines output format**: Specifies exact markdown structure with severity, file reference, risk, and fix — making the output machine-parseable if needed

```typescript
_model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction: SYSTEM_PROMPT,
  generationConfig: {
    temperature: 0.2,      // low randomness = consistent, deterministic output
    maxOutputTokens: 2048, // cap response length
  },
});
```

**`temperature: 0.2`** is critical. At `temperature: 1.0`, the model is creative and unpredictable. At `0.0`, it's fully deterministic. `0.2` gives consistent, fact-based output while allowing slight variation in phrasing — exactly right for a security tool.

#### 7.3 Diff Truncation

```typescript
const MAX_DIFF_CHARS = 50_000;
const truncated =
  diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n*(diff truncated at 50k chars)*'
    : diff;
```

50,000 characters is approximately 1,250–2,500 lines of code. This covers:
- ~99% of real-world PRs
- Stays well within Gemini's token limits
- Keeps costs low

For very large PRs (e.g., a massive refactor), the model sees the most important (earliest-in-diff) changes. A future enhancement could chunk the diff and run multiple audit passes.

#### 7.4 Retry Logic

```typescript
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
  }
}
throw lastError!;
```

Gemini can fail with transient errors (rate limits, 503s, network timeouts). The retry logic:
- Attempt 0: immediate
- Attempt 1: wait 2 seconds (2000ms × 1)
- Attempt 2: wait 4 seconds (2000ms × 2)
- After 3 total failures: throw, BullMQ retries the whole job with exponential backoff

This is **two levels of retry**: Gemini-level (fast, 2–4s) and queue-level (slow, 5–20s). The idea is to handle transient blips at the Gemini level without burning queue retry attempts.

#### 7.5 Model Singleton

```typescript
let _model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!_model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
    const genAI = new GoogleGenerativeAI(apiKey);
    _model = genAI.getGenerativeModel({ ... });
  }
  return _model;
}
```

The `GenerativeModel` object is lightweight (it doesn't hold a persistent connection — each `generateContent` call is a fresh HTTPS request), but the singleton pattern:
1. Validates the API key once at startup, not on every call
2. Initializes the system prompt once
3. Makes it trivial to swap models or add caching later

---

## 8. GitHub API Integration — Octokit

### Used in: `lib/worker.ts`

#### 8.1 Fetching the Diff

```typescript
const response = await octokit.pulls.get({
  owner,
  repo,
  pull_number: prNumber,
  mediaType: { format: 'diff' },  // ← key line
});
```

The `mediaType: { format: 'diff' }` tells Octokit to send `Accept: application/vnd.github.diff` in the request header. Without this, GitHub returns a JSON object describing the PR. With it, GitHub returns the raw **unified diff** format:

```diff
diff --git a/src/auth.ts b/src/auth.ts
index 1234567..abcdefg 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,8 @@ function login(username: string, password: string) {
+  const query = `SELECT * FROM users WHERE username = '${username}'`;
+  db.execute(query);
```

This is exactly what a human code reviewer sees. Sending only the diff (not the entire file) is crucial because:
- It focuses Gemini on what actually changed, not existing code
- It dramatically reduces token usage
- It prevents false positives on pre-existing issues

#### 8.2 Posting the Comment

```typescript
await octokit.issues.createComment({
  owner,
  repo,
  issue_number: prNumber,  // PRs are issues in GitHub's API
  body: `## 🔍 DevInsight Security Audit\n\n${auditResult}\n\n...`,
});
```

In GitHub's data model, Pull Requests are a superset of Issues. Every PR has an issue number, and issue comments appear on the PR timeline. This is the simplest way to post feedback — no special PR review API needed.

#### 8.3 Authentication

Currently using a **Personal Access Token (PAT)**:
```typescript
new Octokit({ auth: process.env.GITHUB_TOKEN });
```

Required scopes:
- `repo` (read access to private repos, or `public_repo` for public only)
- The token needs write access to issues (to post comments)

---

## 9. Frontend — Next.js App Router

### Files: `app/layout.tsx`, `app/page.tsx`, `app/dashboard/page.tsx`

#### 9.1 App Router vs Pages Router

This project uses Next.js **App Router** (introduced in Next.js 13, stable in 14+). Key differences from the old Pages Router:

| Feature | App Router | Pages Router |
|---|---|---|
| File convention | `app/page.tsx` | `pages/index.tsx` |
| API routes | `app/api/webhook/route.ts` | `pages/api/webhook.ts` |
| Server components | Default | Not available |
| Layouts | Nested `layout.tsx` files | `_app.tsx` |
| Data fetching | `async` components, `fetch()` | `getServerSideProps`, `getStaticProps` |

#### 9.2 Server vs Client Components

- `app/layout.tsx` → **Server Component** (default). Renders on the server, sends HTML.
- `app/page.tsx` (landing) → **Server Component**. No interactivity needed, better SEO.
- `app/dashboard/page.tsx` → **Client Component** (`'use client'` directive). Required because Recharts uses browser APIs (`window`, `ResizeObserver`) that don't exist on the server.

#### 9.3 Font Loading

```typescript
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
```

`next/font/google` downloads fonts at **build time** and serves them from your own domain. No external font requests at runtime — better privacy, better performance, no GDPR concerns.

#### 9.4 The Dashboard (Mock Data)

The dashboard currently uses hardcoded mock data arrays. To make it live:

1. Store audit results in a database (Postgres with Prisma, or PlanetScale)
2. Create a server-side API route like `GET /api/stats`
3. Fetch from the dashboard using `useEffect` or React Server Components with `fetch`

The chart structure is already production-ready — only the data source needs to change.

#### 9.5 Recharts

Recharts is a React charting library built on top of D3. It's used because:
- **React-native**: components, not imperative D3 code
- **Responsive**: `ResponsiveContainer` handles window resizing
- **Lightweight**: tree-shakeable, only import the chart types you use

---

## 10. Containerization — Docker

### Files: `Dockerfile`, `worker.Dockerfile`, `docker-compose.yml`

#### 10.1 The API Dockerfile (Multi-Stage Build)

```dockerfile
# Stage 1: Install only production dependencies
FROM node:20-alpine AS deps
RUN npm ci --omit=dev

# Stage 2: Build the Next.js app (needs devDependencies like TypeScript)
FROM node:20-alpine AS builder
RUN npm ci
RUN npm run build

# Stage 3: Tiny production image
FROM node:20-alpine AS runner
COPY --from=builder /app/.next/standalone ./   # ← standalone output
COPY --from=builder /app/.next/static ./.next/static
USER nextjs  # non-root user for security
CMD ["node", "server.js"]
```

**Why multi-stage?** The final image only contains what's needed to run — not the TypeScript compiler, ESLint, or thousands of devDependencies. A single-stage build would be ~800MB. Multi-stage brings it to ~150MB.

**Standalone output** (`next.config.ts: output: 'standalone'`) makes Next.js bundle everything needed into `.next/standalone/server.js`. You can run it without `node_modules` — Next.js traces all imports at build time and copies only what's actually used.

#### 10.2 The Worker Dockerfile

```dockerfile
FROM node:20-alpine
RUN npm install -g tsx         # TypeScript runtime
RUN npm ci                     # all dependencies
CMD ["node", "--import", "tsx/esm", "worker.mjs"]
```

The worker doesn't need a build step because tsx runs TypeScript directly. This is simpler but slightly slower to start (TypeScript is compiled JIT on first import). Acceptable for a long-running process.

#### 10.3 Docker Compose

```yaml
services:
  redis:
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']

  api:
    depends_on:
      redis:
        condition: service_healthy   # ← waits for Redis to be ready

  worker:
    depends_on:
      redis:
        condition: service_healthy   # ← same
```

`condition: service_healthy` prevents the API and worker from starting before Redis is actually accepting connections. Without this, they'd try to connect to Redis before it's ready, fail, and crash.

The Redis `volumes: redis_data:/data` setting enables **RDB persistence** — Redis snapshots its in-memory data to disk. If the Redis container restarts, queued jobs are not lost.

#### 10.4 Networking

All three containers share a **default Docker network** created by Compose. Within this network:
- Containers address each other by **service name**: `redis://redis:6379` (not `localhost`)
- The `api` container's port 3000 is mapped to the host's port 3000
- Redis port 6379 is mapped to the host for local development tooling (e.g., Redis Insight)

---

## 11. CI/CD — GitHub Actions

### File: `.github/workflows/deploy.yml`

#### 11.1 Trigger

```yaml
on:
  push:
    branches:
      - main
```

Builds and pushes Docker images on every push to `main`. For a feature branch workflow, you'd add a separate job that runs tests on pull requests.

#### 11.2 Docker Layer Caching

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

GitHub Actions Cache stores Docker layer cache between runs. If only `app/page.tsx` changed, Docker reuses the cached layers for `npm ci`, `npm run build`, etc. Build time drops from ~4 minutes to ~30 seconds.

#### 11.3 Image Tagging Strategy

```yaml
tags: |
  type=sha,prefix=sha-    # sha-abc1234 — immutable, tied to git commit
  type=raw,value=latest   # latest — always points to newest
```

`sha-abc1234` tags are immutable — you can always roll back to a specific commit's image. `latest` is a convenience pointer for `docker pull devinsight-api`.

#### 11.4 Required GitHub Secrets

| Secret | Value |
|---|---|
| `DOCKER_HUB_USERNAME` | Your Docker Hub username |
| `DOCKER_HUB_TOKEN` | Docker Hub access token (not password) |

Set these in your repo: **Settings → Secrets and variables → Actions → New repository secret**

---

## 12. Security Design

#### 12.1 HMAC Verification (Replay Attack Prevention)

Every webhook is verified with HMAC-SHA256 before any code runs. This prevents:
- **Spoofed webhooks**: An attacker can't fake a webhook without knowing your `WEBHOOK_SECRET`
- **Replay attacks**: Each delivery has a unique ID; combined with idempotent job IDs, replaying an old webhook just skips the already-completed job

#### 12.2 Idempotency via Delivery ID

Using `x-github-delivery` as the BullMQ job ID means:
- GitHub retries (automatic, after delivery failure) → no duplicate audits
- Your own retries (manual re-delivery in GitHub UI) → no duplicate audits
- Network duplicates → no duplicate audits

#### 12.3 Non-Root Container User

```dockerfile
RUN addgroup --system --gid 1001 nodejs
    && adduser --system --uid 1001 nextjs
USER nextjs
```

Running as `root` inside a container is a security risk — if an attacker exploits a vulnerability in your app, they'd have root access to the container and potentially the host. A non-root user limits blast radius.

#### 12.4 Secret Management

All secrets are environment variables, never hardcoded:
- `WEBHOOK_SECRET` — GitHub webhook signing secret
- `GITHUB_TOKEN` — GitHub PAT for API access
- `GEMINI_API_KEY` — Google AI Studio API key
- `UPSTASH_REDIS_URL` — includes password in URL

In production, use a secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler) instead of `.env` files.

#### 12.5 What DevInsight Does NOT Do (and Should)

| Missing control | Risk | Fix |
|---|---|---|
| No rate limiting on `/api/webhook` | DoS via repeated POST requests | Add `@upstash/ratelimit` middleware |
| No request size limit | Large body DoS | Add `Content-Length` check before `req.text()` |
| PAT has broad scope | Token compromise = full repo access | Switch to GitHub App with minimal permissions |
| No audit log | Can't prove who audited what | Store audit events in a database |

---

## 13. Reliability Patterns

#### 13.1 Pattern: Fire-and-Forget with Guaranteed Delivery

The webhook handler enqueues the job and immediately returns 200. The job is persisted in Redis. Even if the worker crashes 1 second after the job is enqueued:
1. Redis still has the job in the `wait` or `active` set
2. When the worker restarts, BullMQ moves stalled active jobs back to wait
3. The job is retried automatically

This is the **"at-least-once delivery"** guarantee.

#### 13.2 Pattern: Singleton Resources

Both Octokit and the Gemini model are module-level singletons:
- Initialized on first use, reused forever
- Node.js is single-threaded per process, so there's no race condition
- If initialization fails (missing env var), the error is thrown on first use, not silently swallowed at startup

#### 13.3 Pattern: Structured Logging

JSON logs with `ts`, `level`, `msg`, and contextual fields enable:
- **Correlation**: query all logs for `jobId: "abc123"` across multiple processes
- **Alerting**: alert when `level: "error"` rate exceeds threshold
- **Dashboards**: visualize job throughput, error rates, response times over time

#### 13.4 Pattern: Health Checks

Docker Compose health checks (`redis-cli ping`) ensure dependent services don't start before their dependencies are ready. In Kubernetes, equivalent `readinessProbe` and `livenessProbe` configs should be added.

---

## 14. Environment Variables Reference

| Variable | Required by | Description | Example |
|---|---|---|---|
| `WEBHOOK_SECRET` | API | HMAC secret for GitHub webhook verification | `openssl rand -hex 32` |
| `GITHUB_TOKEN` | Worker | PAT for reading PR diffs and posting comments | `ghp_abc123...` |
| `GEMINI_API_KEY` | Worker | Google AI Studio API key | `AIza...` |
| `UPSTASH_REDIS_URL` | API + Worker | Redis connection string | `redis://localhost:6379` or `rediss://:password@host:port` |
| `NODE_ENV` | API | Set to `production` in Docker | `production` |
| `PORT` | API | Port Next.js listens on | `3000` |
| `HOSTNAME` | API | Bind address inside container | `0.0.0.0` |

#### How to generate `WEBHOOK_SECRET`:
```bash
openssl rand -hex 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Where to get `GEMINI_API_KEY`:
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click "Get API key" → "Create API key"
3. Copy the key starting with `AIza`

#### Minimum GitHub token scopes:
- Public repos: `public_repo`
- Private repos: `repo`
- Plus `issues:write` to post comments (included in `repo`)

---

## 15. Alternatives for Every Component

### 15.1 AI Model Alternatives

| Alternative | Pros | Cons | When to use |
|---|---|---|---|
| **Gemini 1.5 Pro** | Better reasoning, catches subtle bugs | 3–5× slower, higher cost | High-value/low-volume repos |
| **GPT-4o (OpenAI)** | Industry standard, great at code | Higher cost, US-only data residency | Teams already on OpenAI |
| **Claude 3.5 Haiku** | Very fast, excellent code understanding | Anthropic API key required | Speed-critical pipelines |
| **Claude 3.5 Sonnet** | Best-in-class security reasoning | Slower, higher cost | Security-critical codebases |
| **Local LLM (Ollama + CodeLlama)** | No data leaves your network | Requires GPU, slower, lower quality | Air-gapped/high-security environments |
| **Semgrep** | Rule-based, no AI, zero false positives | Only catches known patterns, no context | Complement to AI, not replacement |

### 15.2 Queue Alternatives

| Alternative | Pros | Cons | When to use |
|---|---|---|---|
| **BullMQ + Redis** ✓ (current) | Fast, battle-tested, rich UI (Bull Board) | Requires Redis instance | Most use cases |
| **AWS SQS** | Managed, scales to millions/sec, dead-letter queues | AWS lock-in, slightly more latency | AWS-native deployments |
| **Google Pub/Sub** | Managed, global, at-least-once + exactly-once | GCP lock-in, more complex setup | GCP-native deployments |
| **RabbitMQ** | Flexible routing, AMQP protocol | More complex ops, stateful | Enterprise/multi-consumer patterns |
| **Inngest** | Serverless, no Redis needed, great DX | Less control, third-party dependency | Vercel/serverless deployments |
| **Trigger.dev** | Developer-friendly, built-in retries, dashboard | SaaS product, cost at scale | Teams wanting managed background jobs |

### 15.3 Database/Cache Alternatives

| Alternative | Pros | Cons |
|---|---|---|
| **Redis** ✓ (current) | In-memory speed, BullMQ native | Memory-limited, separate service |
| **Upstash Redis** | Serverless, no infra, HTTP-based | Latency slightly higher than self-hosted |
| **PostgreSQL + pg-boss** | ACID, SQL queries, single DB | Slower than Redis, polling-based |
| **SQLite + Litestream** | Zero dependency, file-based | Not distributed, no horizontal scale |

### 15.4 GitHub Integration Alternatives

| Alternative | Pros | Cons |
|---|---|---|
| **Personal Access Token** ✓ (current) | Simple setup | Tied to individual user, broad scope |
| **GitHub App** | Fine-grained permissions, installable on any repo, no user tied | More setup (private key, JWT, installation tokens) |
| **GitHub Actions (direct integration)** | No webhook server needed, runs inside GitHub | Limited to GitHub Actions environment, slower feedback |
| **GitLab Webhooks** | Same pattern, different API | Replace Octokit with `@gitbeaker/rest` |
| **Bitbucket Webhooks** | Same pattern, different API | Replace Octokit with Bitbucket REST API |

### 15.5 Hosting Alternatives

| Alternative | Pros | Cons |
|---|---|---|
| **Docker Compose** ✓ (current) | Simple, self-contained, works anywhere | Manual scaling, no orchestration |
| **Google Cloud Run** | Auto-scales to zero, pay-per-use, managed | Cold starts, stateless only (need external Redis) |
| **Render** | Simple deploys, built-in Redis, free tier | Less control than AWS/GCP |
| **Railway** | Excellent DX, one-click deploys, built-in Redis | Smaller ecosystem |
| **Kubernetes** | Enterprise-grade scaling, self-healing | Complex to operate, overkill for small projects |
| **Fly.io** | Fast global edge, persistent volumes | Smaller community |

### 15.6 Frontend Alternatives

| Alternative | Pros | Cons |
|---|---|---|
| **Next.js** ✓ (current) | Full-stack, App Router, RSC, great DX | Larger bundle than pure Vite |
| **Remix** | Better data loading patterns, web standards | Smaller ecosystem |
| **Vite + React** | Faster dev server, simpler | Need separate API server |
| **SvelteKit** | Smaller bundle, excellent performance | Smaller talent pool |

### 15.7 Charting Alternatives

| Alternative | Pros | Cons |
|---|---|---|
| **Recharts** ✓ (current) | React-native, simple API | Less customizable than D3 |
| **Tremor** | Tailwind-styled, beautiful defaults | Less chart variety |
| **Chart.js** | Lightweight, many chart types | Canvas-based (not SVG), imperative API |
| **Victory** | React-native, good animations | Large bundle |
| **D3.js** | Ultimate flexibility | Steep learning curve, imperative |
| **Observable Plot** | Modern, declarative, great defaults | Newer, smaller community |

---

## 16. Future Enhancements

### 16.1 Short-term (1–2 weeks)

#### Persistent Database for Live Dashboard

Currently the dashboard uses mock data. Add a real database:

```bash
npm install prisma @prisma/client
npx prisma init
```

Schema:
```prisma
model AuditResult {
  id            String   @id @default(cuid())
  owner         String
  repo          String
  prNumber      Int
  headSha       String
  findings      Json     // array of { severity, type, file, risk, fix }
  responseTimeMs Int
  createdAt     DateTime @default(now())
}
```

In the worker, save the parsed audit result to the database after posting the comment. The dashboard fetches from a `/api/stats` route backed by Prisma queries.

#### GitHub App Authentication

Replace PAT with a GitHub App for:
- Fine-grained permissions (only the repos that install the app)
- Not tied to any individual's account
- Installable on organizations

```typescript
import { createAppAuth } from '@octokit/auth-app';

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    installationId: installationId,  // from webhook payload
  },
});
```

#### Rate Limiting on the Webhook Endpoint

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

// In the route handler:
const { success } = await ratelimit.limit(req.ip ?? 'global');
if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
```

### 16.2 Medium-term (1–2 months)

#### PR Review API (inline comments)

Instead of a single comment, post inline comments directly on the specific lines that have issues:

```typescript
await octokit.pulls.createReviewComment({
  owner, repo, pull_number: prNumber,
  body: finding.fix,
  commit_id: headSha,
  path: finding.file,
  line: finding.lineNumber,
});
```

This requires parsing the Gemini output to extract exact file paths and line numbers — doable with a structured JSON output format from Gemini.

#### Diff Chunking for Large PRs

For PRs larger than 50k chars, split the diff by file and audit each file separately:

```typescript
function chunkDiff(diff: string): string[] {
  // Split at "diff --git" markers
  return diff.split(/^diff --git /m).filter(Boolean).map(c => 'diff --git ' + c);
}

const chunks = chunkDiff(diff);
const results = await Promise.all(chunks.map(auditDiff));
```

#### Severity Threshold Configuration

Allow repo owners to configure minimum severity for posting comments:

```yaml
# .devinsight.yml in the repo root
min_severity: HIGH  # only post if CRITICAL or HIGH findings exist
ignore_paths:
  - '*.test.ts'
  - 'migrations/**'
```

#### Bull Board (Queue Dashboard)

Add visibility into the queue state:

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { NextAdapter } from '@bull-board/nextjs';

const serverAdapter = new NextAdapter();
createBullBoard({
  queues: [new BullMQAdapter(prReviewQueue)],
  serverAdapter,
});

export const { GET, POST } = serverAdapter.registerHandlers();
```

Access at `/api/bull-board` — shows job counts, retry failed jobs, inspect job data.

### 16.3 Long-term (3–6 months)

#### Multi-Provider AI with Fallback

```typescript
async function auditWithFallback(diff: string): Promise<string> {
  try {
    return await auditWithGemini(diff);
  } catch {
    console.warn('Gemini failed, falling back to OpenAI');
    return await auditWithOpenAI(diff);
  }
}
```

#### Historical Trend Analysis

Track which types of bugs appear most in which repos, which developers introduce the most issues, which file paths are hotspots. Surfaces in the dashboard as heatmaps and leaderboards.

#### Slack/Teams Integration

Post audit summaries to a Slack channel for team-wide visibility:

```typescript
await fetch(process.env.SLACK_WEBHOOK_URL!, {
  method: 'POST',
  body: JSON.stringify({
    text: `🔴 Critical finding in *${owner}/${repo}#${prNumber}*`,
    blocks: [ /* rich message blocks */ ],
  }),
});
```

#### Custom Rule Engine

Allow teams to define their own security rules in addition to AI analysis:

```typescript
interface CustomRule {
  pattern: RegExp;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

// Example: always flag TODO: security comments
const rules: CustomRule[] = [
  { pattern: /TODO.*security/i, severity: 'MEDIUM', message: 'Unresolved security TODO' },
  { pattern: /eval\(/, severity: 'CRITICAL', message: 'eval() is dangerous' },
];
```

#### Kubernetes Deployment

For true production scale:

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devinsight-worker
spec:
  replicas: 3  # 3 worker pods = 9 concurrent jobs
  template:
    spec:
      containers:
        - name: worker
          image: devinsight-worker:latest
          resources:
            requests: { memory: "128Mi", cpu: "100m" }
            limits: { memory: "512Mi", cpu: "500m" }
```

With Kubernetes, you can autoscale workers based on the Redis queue depth using KEDA (Kubernetes Event-Driven Autoscaling).

#### Webhook Verification Middleware

Extract signature verification into a reusable Next.js middleware so it applies to all routes under `/api/webhook/`:

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/webhook')) {
    // verify signature here
  }
}
```

---

## 17. Glossary

| Term | Definition |
|---|---|
| **BullMQ** | A Redis-backed job queue library for Node.js. Handles concurrency, retries, scheduling, and job lifecycle. |
| **Diff / Unified Diff** | A text format showing exactly what lines were added (+) and removed (-) in a file change. The standard format used by `git diff`. |
| **ESM** | ECMAScript Modules — the modern JavaScript module system using `import`/`export`. Opposite of CommonJS (`require`/`module.exports`). |
| **HMAC** | Hash-based Message Authentication Code. A way to verify that a message came from a trusted source by signing it with a shared secret. |
| **Idempotent** | An operation that produces the same result when applied multiple times. "Add this job with ID X" is idempotent — adding it twice results in one job. |
| **IORedis** | A high-performance Redis client for Node.js. Used by BullMQ for all Redis communication. |
| **Octokit** | The official GitHub SDK for JavaScript/TypeScript. Wraps the GitHub REST API. |
| **PR / Pull Request** | A request to merge a branch into the main codebase. The primary unit of code review in GitHub. |
| **Redis** | An in-memory data structure store. Used here as a message queue (via BullMQ) and job state store. |
| **Singleton** | A design pattern where a class or resource is instantiated exactly once and reused. |
| **SIGTERM** | A Unix signal asking a process to terminate gracefully. Sent by Docker/Kubernetes during container shutdown. |
| **Structured Logging** | Logging where each entry is a JSON object with defined fields, as opposed to free-form strings. Enables machine parsing and querying. |
| **System Prompt** | Instructions given to an LLM before the user's message. Defines the model's persona, constraints, and output format. |
| **Timing Attack** | A side-channel attack where an attacker infers information from how long an operation takes, not from its output. |
| **tsx** | A TypeScript execution engine for Node.js. Runs `.ts` files directly without compiling first. |
| **Unified Diff** | See "Diff". The `@@ -line,count +line,count @@` format produced by `git diff`. |
| **Webhook** | An HTTP callback — a server sends a POST request to a URL when an event happens. GitHub uses webhooks to notify external systems about PR events. |
| **Worker** | A long-running process that picks up jobs from a queue and executes them. Separate from the web server. |

---

*Generated for DevInsight v1.0 · Last updated 2026-03-29*
