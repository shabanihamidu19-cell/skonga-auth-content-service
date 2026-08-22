'use strict';
const env = require('./config/env');
const db = require('./config/db');
const app = require('./app');

async function main() {
  await db.ready;
  app.listen(env.port, () => {
    console.log(`✅ SKONGA auth-content-service on port ${env.port} (${env.nodeEnv})`);
    console.log(`   DB driver: ${db.driver}${db.driver === 'postgres' ? ' (durable)' : ''}`);
    if (db.driver !== 'postgres') {
      console.log(`   Path: ${env.databasePath}`);
    }
    console.log(`   Quotas free chat/day: ${env.quotas.free.chat}`);
  });
}

main().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
