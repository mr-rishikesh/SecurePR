import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prReviewQueue } from '@/lib/queue';

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = `sha256=${hmac.digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

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

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const event = req.headers.get('x-github-event');
  const action = (payload as { action?: string }).action;

  if (
    event === 'pull_request' &&
    (action === 'opened' || action === 'synchronize')
  ) {
    const pr = (payload as { pull_request?: Record<string, unknown> }).pull_request;
    const repo = (payload as { repository?: Record<string, unknown> }).repository;

    if (!pr || !repo) {
      return NextResponse.json({ error: 'Missing PR or repo data' }, { status: 400 });
    }

    await prReviewQueue.add('review-pr', {
      prNumber: pr.number,
      owner: (repo.owner as { login: string }).login,
      repo: repo.name,
      headSha: (pr.head as { sha: string }).sha,
      enqueuedAt: Date.now(),
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
