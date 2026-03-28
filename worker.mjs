/**
 * Standalone worker entry point for Docker.
 * Starts the BullMQ worker that processes PR review jobs.
 *
 * Usage: node worker.mjs
 * (Requires ts-node or compiled JS — for Docker, compile first via `next build` or use tsx)
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Use tsx to handle TypeScript imports at runtime
register('tsx/esm', pathToFileURL('./'));

const { startWorker } = await import('./lib/worker.ts');

const worker = startWorker();

async function shutdown() {
  console.log('[Worker] Shutting down gracefully...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
