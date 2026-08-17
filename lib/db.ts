import fs from 'fs';
import path from 'path';
import { redisConnection } from './queue';

const DB_FILE = path.join(process.cwd(), 'lib', 'audits-db.json');

// Helper to check if Redis connection is active and ready
function isRedisReady(): boolean {
  return redisConnection.status === 'ready';
}

export async function storeAudit(audit: any): Promise<void> {
  const auditStr = JSON.stringify(audit);

  if (isRedisReady()) {
    try {
      await redisConnection.lpush('devinsight:audits', auditStr);
      await redisConnection.ltrim('devinsight:audits', 0, 999);
      console.log('Successfully saved audit log to Redis');
      return;
    } catch (err) {
      console.error('Failed to save to Redis, falling back to local file:', (err as Error).message);
    }
  }

  // Fallback to local file database
  try {
    let audits = [];
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      audits = JSON.parse(content);
    }
    audits.unshift(audit); // Newer audits first
    if (audits.length > 1000) {
      audits = audits.slice(0, 1000);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(audits, null, 2), 'utf8');
    console.log('Successfully saved audit log to local JSON database');
  } catch (err) {
    console.error('Failed to save audit to local JSON file:', (err as Error).message);
  }
}

export async function getAudits(): Promise<any[]> {
  if (isRedisReady()) {
    try {
      const strings = await redisConnection.lrange('devinsight:audits', 0, -1);
      if (strings && strings.length > 0) {
        return strings.map((s) => JSON.parse(s));
      }
    } catch (err) {
      console.error('Failed to read audits from Redis, falling back to local file:', (err as Error).message);
    }
  }

  // Fallback to local file database
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Failed to read audits from local JSON file:', (err as Error).message);
  }
  return [];
}

export async function clearAudits(): Promise<void> {
  if (isRedisReady()) {
    try {
      await redisConnection.del('devinsight:audits');
      console.log('Cleared audits in Redis');
    } catch (err) {
      console.error('Failed to clear audits in Redis:', (err as Error).message);
    }
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
      console.log('Cleared local JSON audits file');
    }
  } catch (err) {
    console.error('Failed to delete local JSON audits file:', (err as Error).message);
  }
}

export async function pushMultipleAudits(audits: any[]): Promise<void> {
  if (isRedisReady()) {
    try {
      for (const audit of audits) {
        await redisConnection.lpush('devinsight:audits', JSON.stringify(audit));
      }
      return;
    } catch (err) {
      console.error('Failed to bulk write to Redis, falling back to local file:', (err as Error).message);
    }
  }

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(audits, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to bulk write to local JSON file:', (err as Error).message);
  }
}
