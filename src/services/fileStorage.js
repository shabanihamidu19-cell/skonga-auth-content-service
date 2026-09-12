'use strict';
/**
 * File storage for user content uploads.
 * - local: disk under UPLOAD_DIR (dev / fallback)
 * - s3: AWS S3 or S3-compatible (Cloudflare R2, MinIO)
 *
 * Multer always buffers in memory when s3 is enabled, then PutObject.
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

const uploadRoot = path.resolve(env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;
  if (env.storage.driver !== 's3') return null;
  // Lazy require so local-only deploys need no AWS package resolution failure hard-path
  const { S3Client } = require('@aws-sdk/client-s3');
  const cfg = env.storage.s3;
  const clientConfig = {
    region: cfg.region || 'auto',
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  };
  if (cfg.endpoint) {
    clientConfig.endpoint = cfg.endpoint;
    clientConfig.forcePathStyle = cfg.forcePathStyle !== false;
  }
  s3Client = new S3Client(clientConfig);
  return s3Client;
}

const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadRoot);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').slice(0, 10);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage: env.storage.driver === 's3' ? memoryStorage : diskStorage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (!ok) return cb(new AppError('Only images and PDF allowed', 400, 'INVALID_FILE'));
    cb(null, true);
  },
});

function makeObjectKey(userId, originalName) {
  const ext = path.extname(originalName || '').slice(0, 10);
  const prefix = env.storage.s3.keyPrefix || 'uploads';
  const uid = String(userId || 'anon').slice(0, 64);
  return `${prefix}/${uid}/${Date.now()}-${uuidv4()}${ext}`;
}

/**
 * After multer: persist buffer to S3 or use local filename.
 * @returns {{ storageKey: string, mimeType: string, size: number, url: string|null }}
 */
async function persistUpload(req) {
  const file = req.file;
  if (!file) return null;

  if (env.storage.driver === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = getS3Client();
    const key = makeObjectKey(req.user && req.user.id, file.originalname);
    await client.send(
      new PutObjectCommand({
        Bucket: env.storage.s3.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // R2 ignores ACL often; public access via bucket public URL / custom domain
      })
    );
    return {
      storageKey: key,
      mimeType: file.mimetype,
      size: file.size,
      url: publicUrlForKey(key),
    };
  }

  // local disk
  const key = file.filename;
  return {
    storageKey: key,
    mimeType: file.mimetype,
    size: file.size,
    url: publicUrlForKey(key),
  };
}

function publicUrlForKey(storageKey) {
  if (!storageKey) return null;
  if (env.storage.driver === 's3' && env.storage.s3.publicBaseUrl) {
    return `${env.storage.s3.publicBaseUrl}/${storageKey}`;
  }
  // Served by Express /files when local
  if (env.storage.driver === 'local') {
    return `/files/${storageKey}`;
  }
  // S3 without public base — client must use signed URL later; store key only
  return null;
}

function publicKey(filenameOrKey) {
  return filenameOrKey;
}

function storageStatus() {
  return {
    driver: env.storage.driver,
    s3: env.storage.driver === 's3',
    bucket: env.storage.driver === 's3' ? env.storage.s3.bucket : null,
    publicBase: env.storage.driver === 's3' ? env.storage.s3.publicBaseUrl || null : '/files',
  };
}

module.exports = {
  upload,
  publicKey,
  uploadRoot,
  persistUpload,
  publicUrlForKey,
  storageStatus,
  getS3Client,
};
