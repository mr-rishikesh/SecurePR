import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prReviewQueue } from '@/lib/queue';

// Prevent Next.js from buffering/limiting the raw body
export const config = { api: { bodyParser: false } };

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = `sha256=${hmac.digest('hex')}`;
  try {
    // Buffers must be equal length for timingSafeEqual
    const a = Buffer.from(digest, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const HANDLED_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const rawBody = await req.text();

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = req.headers.get('x-github-event');
  const deliveryId = req.headers.get('x-github-delivery') ?? crypto.randomUUID();

  // GitHub sends a ping when a webhook is first created — acknowledge it
  if (event === 'ping') {
    return NextResponse.json({ ok: true, message: 'pong' }, { status: 200 });
  }

  // Ignore non-PR events early — before JSON parsing
  if (event !== 'pull_request') {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const action = payload.action as string | undefined;
  if (!action || !HANDLED_ACTIONS.has(action)) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  const pr = payload.pull_request as Record<string, unknown> | undefined;
  const repo = payload.repository as Record<string, unknown> | undefined;
  if (!pr || !repo) {
    return NextResponse.json({ error: 'Missing PR or repo data' }, { status: 400 });
  }

  // Use deliveryId as jobId — GitHub retries the same delivery ID, so this is idempotent
  await prReviewQueue.add(
    'review-pr',
    {
      prNumber: pr.number as number,
      owner: (repo.owner as { login: string }).login,
      repo: repo.name as string,
      headSha: (pr.head as { sha: string }).sha,
      deliveryId,
      enqueuedAt: Date.now(),
    },
    { jobId: deliveryId }
  );

  return NextResponse.json({ ok: true, jobId: deliveryId }, { status: 200 });
}
