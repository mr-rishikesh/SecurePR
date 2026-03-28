/**
 * Standalone worker entry point for Docker.
 * Usage: node --import tsx/esm worker.mjs
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('tsx/esm', pathToFileURL('./'));

const { startWorker } = await import('./lib/worker.ts');

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Unhandled rejection', reason: String(reason) }));
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Uncaught exception', error: err.message }));
  process.exit(1);
});

const worker = startWorker();

async function shutdown(signal) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg: `Shutting down on ${signal}` }));
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
