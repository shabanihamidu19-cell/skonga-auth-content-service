'use strict';
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

const uploadRoot = path.resolve(env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadRoot);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').slice(0, 10);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (!ok) return cb(new AppError('Only images and PDF allowed', 400, 'INVALID_FILE'));
    cb(null, true);
  },
});

function publicKey(filename) {
  return filename;
}

module.exports = { upload, publicKey, uploadRoot };
