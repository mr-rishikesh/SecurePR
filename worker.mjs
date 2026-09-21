import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

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
