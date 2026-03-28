import { Worker, Job } from 'bullmq';
import { Octokit } from '@octokit/rest';
import { auditDiff } from './gemini';
import { redisConnection } from './queue';

interface PRJobData {
  prNumber: number;
  owner: string;
  repo: string;
  headSha: string;
  enqueuedAt: number;
}

function createOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }
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
    body: `## DevInsight Security Audit\n\n${body}\n\n---\n*Powered by DevInsight AI PR Auditor*`,
  });
}

async function processJob(job: Job<PRJobData>): Promise<void> {
  const { prNumber, owner, repo, enqueuedAt } = job.data;

  console.log(`[Worker] Processing PR #${prNumber} for ${owner}/${repo}`);

  const octokit = createOctokit();

  const diff = await fetchPRDiff(octokit, owner, repo, prNumber);
  if (!diff || diff.trim().length === 0) {
    console.log(`[Worker] Empty diff for PR #${prNumber}, skipping`);
    return;
  }

  const MAX_DIFF_CHARS = 50000;
  const truncatedDiff = diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + '\n... (diff truncated due to size)'
    : diff;

  const auditResult = await auditDiff(truncatedDiff);

  const responseTimeMs = Date.now() - enqueuedAt;
  const responseTimeSecs = (responseTimeMs / 1000).toFixed(1);

  const comment = `${auditResult}\n\n*Analysis completed in ${responseTimeSecs}s*`;
  await postPRComment(octokit, owner, repo, prNumber, comment);

  console.log(`[Worker] Posted audit comment for PR #${prNumber} (${responseTimeSecs}s)`);
}

export function startWorker(): Worker<PRJobData> {
  const worker = new Worker<PRJobData>('pr-review', processJob, {
    connection: redisConnection,
    concurrency: 3,
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  console.log('[Worker] PR review worker started and listening for jobs...');
  return worker;
}
