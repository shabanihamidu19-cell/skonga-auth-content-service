'use strict';
const { verifyToken } = require('../utils/jwt');
const { AppError } = require('../utils/errors');
const env = require('../config/env');

/** Require Authorization: Bearer <JWT> — identity from token only */
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) throw new AppError('Missing Authorization bearer token', 401, 'UNAUTHORIZED');
    const payload = verifyToken(m[1].trim());
    if (!payload.sub) throw new AppError('Invalid token payload', 401, 'UNAUTHORIZED');
    req.user = { id: payload.sub, email: payload.email || null };
    next();
  } catch (err) {
    next(err.status ? err : new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
  }
}

/** Optional auth — attaches user if token present */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return next();
  try {
    const payload = verifyToken(m[1].trim());
    if (payload.sub) req.user = { id: payload.sub, email: payload.email || null };
  } catch {
    /* ignore */
  }
  next();
}

/** AI backend / internal services: X-Service-Token */
function requireServiceToken(req, res, next) {
  if (!env.serviceToken) {
    return next(new AppError('SERVICE_TOKEN not configured', 503, 'CONFIG'));
  }
  const token = req.headers['x-service-token'] || '';
  if (token !== env.serviceToken) {
    return next(new AppError('Invalid service token', 401, 'UNAUTHORIZED'));
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireServiceToken };
