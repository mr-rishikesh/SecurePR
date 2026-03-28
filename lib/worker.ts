import { Worker, Job } from 'bullmq';
import { Octokit } from '@octokit/rest';
import { auditDiff } from './gemini';
import { redisConnection } from './queue';

export interface PRJobData {
  prNumber: number;
  owner: string;
  repo: string;
  headSha: string;
  deliveryId: string;
  enqueuedAt: number;
}

function log(level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, msg, ...meta };
  if (level === 'error') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function createOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN environment variable is not set');
  return new Octokit({ auth: token });
}

async function fetchPRDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });
  return response.data as unknown as string;
}

async function postPRComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: [
      '## DevInsight Security Audit',
      '',
      body,
      '',
      '---',
      '*Powered by [DevInsight](https://github.com) · Gemini 1.5 Flash*',
    ].join('\n'),
  });
}

async function processJob(job: Job<PRJobData>): Promise<void> {
  const { prNumber, owner, repo, headSha, enqueuedAt } = job.data;
  const label = `${owner}/${repo}#${prNumber}`;

  log('info', 'Processing job', { jobId: job.id, pr: label, sha: headSha, attempt: job.attemptsMade + 1 });

  await job.updateProgress(10);

  const octokit = createOctokit();
  const diff = await fetchPRDiff(octokit, owner, repo, prNumber);

  if (!diff || diff.trim().length === 0) {
    log('warn', 'Empty diff — skipping', { pr: label });
    return;
  }

  await job.updateProgress(40);
  log('info', 'Diff fetched, sending to Gemini', { pr: label, diffChars: diff.length });

  const auditResult = await auditDiff(diff);

  await job.updateProgress(80);

  const responseTimeSecs = ((Date.now() - enqueuedAt) / 1000).toFixed(1);
  const comment = `${auditResult}\n\n*Analysis completed in ${responseTimeSecs}s · commit \`${headSha.slice(0, 7)}\`*`;

  await postPRComment(octokit, owner, repo, prNumber, comment);
  await job.updateProgress(100);

  log('info', 'Audit comment posted', { pr: label, responseTimeSecs });
}

export function startWorker(): Worker<PRJobData> {
  const worker = new Worker<PRJobData>('pr-review', processJob, {
    connection: redisConnection,
    concurrency: 3,
    limiter: { max: 10, duration: 60_000 }, // max 10 jobs/min to respect API rate limits
  });

  worker.on('completed', (job) => {
    log('info', 'Job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    log('error', 'Job failed', { jobId: job?.id, error: err.message, attempt: job?.attemptsMade });
  });

  worker.on('error', (err) => {
    log('error', 'Worker error', { error: err.message });
  });

  worker.on('stalled', (jobId) => {
    log('warn', 'Job stalled', { jobId });
  });

  log('info', 'PR review worker started', { concurrency: 3, queue: 'pr-review' });
  return worker;
}
