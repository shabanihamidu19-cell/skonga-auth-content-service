'use strict';
const usageService = require('../services/usageService');
const userRepo = require('../repositories/userRepository');
const subRepo = require('../repositories/subscriptionRepository');

function ensureIdentity(userId) {
  userRepo.ensureShadowUser(String(userId));
  subRepo.ensureFree(String(userId));
}

async function getSnapshot(req, res, next) {
  try {
    res.json(usageService.snapshot(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function check(req, res, next) {
  try {
    const action = (req.query.action || req.body?.action || 'chat').toString();
    const q = usageService.checkQuota(req.user.id, action);
    res.json(q);
  } catch (err) {
    next(err);
  }
}

/** Called by AI backend — body: { userId, action, units?, metadata? } */
async function internalRecord(req, res, next) {
  try {
    const { userId, action, units, metadata } = req.body || {};
    if (!userId || !action) {
      return res.status(400).json({ error: 'userId and action required', code: 'BAD_REQUEST' });
    }
    ensureIdentity(userId);
    const before = usageService.assertAllowed(userId, action);
    const after = usageService.recordUsage(userId, action, units || 1, metadata || {});
    res.json({ ok: true, before, after });
  } catch (err) {
    if (err.code === 'QUOTA_EXCEEDED') {
      return res.status(403).json({ error: err.message, code: err.code, quota: err.quota });
    }
    next(err);
  }
}

async function internalCheck(req, res, next) {
  try {
    const userId = (req.query.userId || req.body?.userId || '').toString();
    const action = (req.query.action || req.body?.action || 'chat').toString();
    if (!userId) return res.status(400).json({ error: 'userId required' });
    ensureIdentity(userId);
    res.json(usageService.checkQuota(userId, action));
  } catch (err) {
    next(err);
  }
}

module.exports = { getSnapshot, check, internalRecord, internalCheck };
