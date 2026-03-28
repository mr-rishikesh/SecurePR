import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.UPSTASH_REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Reconnect with backoff so the app doesn't crash on transient Redis drops
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

redisConnection.on('error', (err) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Redis error', error: err.message }));
});

export const prReviewQueue = new Queue('pr-review', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});
