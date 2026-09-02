import { createServer } from 'node:http';
import { createApp, createServices } from './app.js';
import { loadEnv } from './config/env.js';
import { createPool } from './database/pool.js';

const env = loadEnv();
const pool = createPool(env);
const server = createServer(createApp(env, createServices(pool, env)));

server.listen(env.PORT, () => {
  console.log(`Celestial API listening on port ${env.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
