import { Worker, Job } from 'bullmq';
import { Octokit } from '@octokit/rest';
import { auditDiff } from './gemini';
import { redisConnection } from './queue';
import { storeAudit } from './db';

export interface PRJobData {
  prNumber: number;
  owner: string;
  repo: string;
  headSha: string;
  deliveryId: string;
  enqueuedAt: number;
  region?: string;
}

function log(level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, msg, ...meta };
  (level === 'error' ? console.error : console.log)(JSON.stringify(entry));
}

function normalizeBugType(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('sql injection') || lower.includes('sql')) return 'SQL Injection';
  if (lower.includes('secret') || lower.includes('key') || lower.includes('token') || lower.includes('credential')) return 'Hardcoded Secrets';
  if (lower.includes('dep') || lower.includes('cve') || lower.includes('vulnerable package') || lower.includes('dependencies')) return 'Insecure Deps';
  if (lower.includes('xss') || lower.includes('cross-site scripting')) return 'XSS';
  if (lower.includes('path traversal') || lower.includes('traversal')) return 'Path Traversal';
  if (lower.includes('auth') || lower.includes('broken authentication') || lower.includes('session')) return 'Broken Auth';
  return 'Sensitive Data';
}

function parseAuditReport(markdown: string) {
  const findings: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
  }> = [];

  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('### [')) {
      // Format example: ### [🔴 CRITICAL] SQL Injection
      const match = trimmed.match(/^###\s+\[([^\]]+)\]\s+(.+)$/);
      if (match) {
        const sevText = match[1].toLowerCase();
        let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (sevText.includes('critical') || sevText.includes('🔴')) {
          severity = 'critical';
        } else if (sevText.includes('high') || sevText.includes('🟠')) {
          severity = 'high';
        } else if (sevText.includes('medium') || sevText.includes('🟡')) {
          severity = 'medium';
        } else if (sevText.includes('low') || sevText.includes('🔵')) {
          severity = 'low';
        }

        const rawType = match[2].trim();
        const type = normalizeBugType(rawType);
        findings.push({ severity, type });
      }
    }
  }

  const bugsCount = findings.length;
  let status: 'critical' | 'warning' | 'clean' = 'clean';
  if (findings.some(f => f.severity === 'critical')) {
    status = 'critical';
  } else if (findings.some(f => f.severity === 'high' || f.severity === 'medium')) {
    status = 'warning';
  }

  const bugTypes = findings.map(f => f.type);

  return { status, bugsCount, bugTypes };
}

// Singleton Octokit — created once, reused across all jobs
let _octokit: Octokit | null = null;
function getOctokit(): Octokit {
  if (!_octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN environment variable is not set');
    _octokit = new Octokit({ auth: token });
  }
  return _octokit;
}

async function fetchPRDiff(owner: string, repo: string, prNumber: number): Promise<string> {
  const octokit = getOctokit();
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });
  return response.data as unknown as string;
}

async function postPRComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
  const octokit = getOctokit();
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: [
      '## 🔍 DevInsight Security Audit',
      '',
      body,
      '',
      '---',
      `*Powered by [DevInsight](https://devinsight.dev) · Gemini 1.5 Flash*`,
    ].join('\n'),
  });
}

async function processJob(job: Job<PRJobData>): Promise<void> {
  const { prNumber, owner, repo, headSha, enqueuedAt, region, deliveryId } = job.data;
  const label = `${owner}/${repo}#${prNumber}`;

  log('info', 'Processing job', { jobId: job.id, pr: label, sha: headSha, attempt: job.attemptsMade + 1 });
  await job.updateProgress(10);

  const diff = await fetchPRDiff(owner, repo, prNumber);
  if (!diff || diff.trim().length === 0) {
    log('warn', 'Empty diff — skipping', { pr: label });
    return;
  }

  await job.updateProgress(40);
  log('info', 'Diff fetched, sending to Gemini', { pr: label, diffChars: diff.length });

  const auditResult = await auditDiff(diff);
  await job.updateProgress(80);

  const responseTimeSecs = parseFloat(((Date.now() - enqueuedAt) / 1000).toFixed(1));
  const { status, bugsCount, bugTypes } = parseAuditReport(auditResult);

  // Store the audit in database (Redis or local file fallback)
  const auditLog = {
    id: job.id || deliveryId,
    owner,
    repo,
    prNumber,
    headSha,
    timestamp: Date.now(),
    responseTimeSecs,
    status,
    bugsCount,
    bugTypes,
    region: region || 'us',
  };

  try {
    await storeAudit(auditLog);
    log('info', 'Audit logged to database', { pr: label, status, bugsCount });
  } catch (dbErr) {
    log('error', 'Failed to store audit in database', { error: (dbErr as Error).message });
  }

  const comment = `${auditResult}\n\n*Analysis completed in ${responseTimeSecs}s · commit \`${headSha.slice(0, 7)}\`*`;

  try {
    await postPRComment(owner, repo, prNumber, comment);
    log('info', 'Audit comment posted', { pr: label, responseTimeSecs });
  } catch (githubErr) {
    log('warn', 'Failed to post comment to GitHub (expected for fake or non-existent test PRs)', { error: (githubErr as Error).message });
  }
  
  await job.updateProgress(100);
}

export function startWorker(): Worker<PRJobData> {
  const worker = new Worker<PRJobData>('pr-review', processJob, {
    connection: redisConnection,
    concurrency: 3,
    limiter: { max: 10, duration: 60_000 },
  });

  worker.on('completed', (job) => log('info', 'Job completed', { jobId: job.id }));
  worker.on('failed', (job, err) => log('error', 'Job failed', { jobId: job?.id, error: err.message, attempt: job?.attemptsMade }));
  worker.on('error', (err) => log('error', 'Worker error', { error: err.message }));
  worker.on('stalled', (jobId) => log('warn', 'Job stalled', { jobId }));

  log('info', 'PR review worker started', { concurrency: 3, queue: 'pr-review' });
  return worker;
}

export async function processJobLocal(data: PRJobData): Promise<void> {
  const mockJob = {
    id: data.deliveryId,
    data,
    attemptsMade: 0,
    updateProgress: async (p: number) => {
      log('info', `Local worker progress: ${p}%`, { pr: `${data.owner}/${data.repo}#${data.prNumber}` });
    }
  };
  return processJob(mockJob as any);
}
