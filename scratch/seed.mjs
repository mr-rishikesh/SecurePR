import IORedis from 'ioredis';
import fs from 'fs';
import path from 'path';

const redisUrl = process.env.UPSTASH_REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 1000,
});

const DB_FILE = path.join(process.cwd(), 'lib', 'audits-db.json');

async function main() {
  console.log('Seeding security audit logs...');

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const repos = ['acme/api', 'acme/frontend', 'acme/infra', 'acme/mobile', 'company/service'];
  const shas = ['a3f9b12', 'c72de45', 'f01bc98', '88a2c31', '2d9f074', 'e3b8a1c', '7d2d9f0'];
  const regions = ['us', 'uk', 'in', 'ca', 'au'];
  const bugTypesPool = ['SQL Injection', 'Hardcoded Secrets', 'Insecure Deps', 'XSS', 'Path Traversal', 'Broken Auth'];

  const mockAudits = [];
  for (let i = 0; i < 50; i++) {
    const dayOffset = Math.floor(Math.random() * 7);
    const timestamp = now - dayOffset * oneDay - Math.floor(Math.random() * oneDay * 0.8);
    const repo = repos[Math.floor(Math.random() * repos.length)];
    const prNumber = 100 + i;
    const headSha = shas[Math.floor(Math.random() * shas.length)];
    const responseTimeSecs = parseFloat((5 + Math.random() * 12).toFixed(1));
    const region = regions[Math.floor(Math.random() * regions.length)];

    const statusSeed = Math.random();
    let status = 'clean';
    let bugsCount = 0;
    let bugTypes = [];

    if (statusSeed < 0.2) {
      status = 'critical';
      bugsCount = 1 + Math.floor(Math.random() * 3);
      bugTypes.push('SQL Injection');
      if (bugsCount > 1) bugTypes.push('Hardcoded Secrets');
    } else if (statusSeed < 0.5) {
      status = 'warning';
      bugsCount = 1 + Math.floor(Math.random() * 2);
      bugTypes.push(bugTypesPool[Math.floor(Math.random() * bugTypesPool.length)]);
    }

    mockAudits.push({
      id: `seed-delivery-${i}`,
      owner: repo.split('/')[0],
      repo: repo.split('/')[1],
      prNumber,
      headSha,
      timestamp,
      responseTimeSecs,
      status,
      bugsCount,
      bugTypes,
      region,
    });
  }

  // Sort descending (newest first) for JSON file database representation
  mockAudits.sort((a, b) => b.timestamp - a.timestamp);

  // Attempt to seed Redis
  let seededInRedis = false;
  try {
    const connectPromise = new Promise((resolve, reject) => {
      redis.once('ready', resolve);
      redis.once('error', reject);
      setTimeout(() => reject(new Error('Redis connection timeout')), 1000);
    });

    await connectPromise;
    await redis.del('devinsight:audits');

    // Sort ascending before pushing so LPUSH stacks newer ones at the head
    const sortedAsc = [...mockAudits].sort((a, b) => a.timestamp - b.timestamp);
    for (const audit of sortedAsc) {
      await redis.lpush('devinsight:audits', JSON.stringify(audit));
    }
    console.log(`Successfully seeded ${mockAudits.length} audits in Redis!`);
    seededInRedis = true;
  } catch (err) {
    console.log('Redis is offline. Falling back to local file database only.');
  } finally {
    redis.disconnect();
  }

  // Always write to JSON file database for fallback reliability
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(mockAudits, null, 2), 'utf8');
    console.log(`Successfully seeded ${mockAudits.length} audits in local file database: ${DB_FILE}`);
  } catch (err) {
    console.error('Failed to seed local JSON database:', err.message);
  }
}

main();
