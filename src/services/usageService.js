'use strict';
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const usageRepo = require('../repositories/usageRepository');
const subRepo = require('../repositories/subscriptionRepository');
const { AppError } = require('../utils/errors');

const ACTIONS = new Set(['chat', 'scan', 'image_generation', 'rag_query', 'file_analysis']);

function getPlanKey(userId) {
  const sub = subRepo.ensureFree(userId);
  return subRepo.isProActive(sub) ? 'pro' : 'free';
}

function limitFor(userId, action) {
  const plan = getPlanKey(userId);
  const table = env.quotas[plan] || env.quotas.free;
  const lim = table[action];
  return lim === undefined ? env.quotas.free.chat : lim;
}

function checkQuota(userId, action) {
  if (!ACTIONS.has(action)) {
    throw new AppError('Unknown usage action', 400, 'INVALID_ACTION');
  }
  const limit = limitFor(userId, action);
  if (limit === 0) {
    return { allowed: true, used: usageRepo.sumToday(userId, action), limit: 0, remaining: null, plan: getPlanKey(userId) };
  }
  const used = usageRepo.sumToday(userId, action);
  const remaining = Math.max(0, limit - used);
  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    plan: getPlanKey(userId),
  };
}

function assertAllowed(userId, action) {
  const q = checkQuota(userId, action);
  if (!q.allowed) {
    const err = new AppError('Daily free limit reached. Upgrade to Pro to continue.', 403, 'QUOTA_EXCEEDED');
    err.quota = q;
    throw err;
  }
  return q;
}

function recordUsage(userId, action, units = 1, metadata = {}) {
  if (!ACTIONS.has(action)) throw new AppError('Unknown usage action', 400, 'INVALID_ACTION');
  usageRepo.record({
    id: uuidv4(),
    userId,
    action,
    units: Math.max(1, Number(units) || 1),
    metadata,
    createdAt: Date.now(),
  });
  return checkQuota(userId, action);
}

function snapshot(userId) {
  const actions = [...ACTIONS];
  const plan = getPlanKey(userId);
  const items = {};
  for (const a of actions) {
    items[a] = checkQuota(userId, a);
  }
  return { plan, items };
}

module.exports = { checkQuota, assertAllowed, recordUsage, snapshot, ACTIONS };
