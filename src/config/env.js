'use strict';
require('dotenv').config();

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : String(v).trim();
}

const s3Bucket = str('S3_BUCKET') || str('R2_BUCKET');
const s3AccessKey = str('S3_ACCESS_KEY_ID') || str('R2_ACCESS_KEY_ID');
const s3SecretKey = str('S3_SECRET_ACCESS_KEY') || str('R2_SECRET_ACCESS_KEY');
const s3Endpoint = str('S3_ENDPOINT') || str('R2_ENDPOINT');
const s3Enabled = !!(s3Bucket && s3AccessKey && s3SecretKey);

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
  storage: {
    /** local | s3 (S3-compatible: AWS, Cloudflare R2, MinIO) */
    driver: s3Enabled ? 's3' : 'local',
    s3: {
      enabled: s3Enabled,
      bucket: s3Bucket,
      region: str('S3_REGION', 'auto') || 'auto',
      endpoint: s3Endpoint || null,
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
      /** Public base for downloads e.g. https://files.skonga.ai or R2 public URL */
      publicBaseUrl: (str('S3_PUBLIC_BASE_URL') || str('R2_PUBLIC_BASE_URL')).replace(/\/$/, ''),
      forcePathStyle:
        String(process.env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false',
      keyPrefix: str('S3_KEY_PREFIX', 'uploads').replace(/^\/|\/$/g, '') || 'uploads',
    },
  },
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

if (env.storage.driver === 'local' && env.nodeEnv === 'production') {
  console.warn(
    '[env] STORAGE is local (UPLOAD_DIR) — files may vanish on Render redeploy. Set S3/R2 env for durable uploads.'
  );
}

module.exports = env;
