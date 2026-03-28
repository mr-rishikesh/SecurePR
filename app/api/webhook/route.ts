import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prReviewQueue } from '@/lib/queue';

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = `sha256=${hmac.digest('hex')}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

const HANDLED_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
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
  // Unique ID per delivery — used as BullMQ job ID for deduplication
  const deliveryId = req.headers.get('x-github-delivery') ?? crypto.randomUUID();

  // Acknowledge non-PR events immediately
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
    // Use deliveryId as jobId so GitHub retries don't create duplicate jobs
    { jobId: deliveryId }
  );

  return NextResponse.json({ ok: true, jobId: deliveryId }, { status: 200 });
}
