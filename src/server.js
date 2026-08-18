'use strict';
const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`✅ SKONGA auth-content-service on port ${env.port} (${env.nodeEnv})`);
  console.log(`   DB: ${env.databasePath}`);
  console.log(`   Quotas free chat/day: ${env.quotas.free.chat}`);
});
