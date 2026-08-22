'use strict';
require('dotenv').config();

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const env = {
  port: int('PORT', 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || '',
  databasePath: process.env.DATABASE_PATH || './data/skonga.sqlite',
  uploadDir: process.env.UPLOAD_DIR || './data/uploads',
  maxUploadMb: int('MAX_UPLOAD_MB', 8),
  serviceToken: process.env.SERVICE_TOKEN || '',
  quotas: {
    free: {
      chat: int('FREE_CHAT_PER_DAY', 10),
      scan: int('FREE_SCAN_PER_DAY', 5),
      image_generation: int('FREE_IMAGE_PER_DAY', 2),
      rag_query: int('FREE_RAG_PER_DAY', 20),
    },
    pro: {
      chat: int('PRO_CHAT_PER_DAY', 0),
      scan: int('PRO_SCAN_PER_DAY', 0),
      image_generation: int('PRO_IMAGE_PER_DAY', 50),
      rag_query: int('PRO_RAG_PER_DAY', 0),
    },
  },
};

if (!env.jwtSecret || env.jwtSecret === 'change-me-to-a-long-random-secret') {
  if (env.nodeEnv === 'production') {
    console.warn('[env] JWT_SECRET is missing or weak — set a strong secret before production');
  }
}

if (env.nodeEnv === 'production' && !env.databaseUrl) {
  console.warn(
    '[env] DATABASE_URL not set — SQLite on ephemeral disk may lose users on redeploy'
  );
}

module.exports = env;
