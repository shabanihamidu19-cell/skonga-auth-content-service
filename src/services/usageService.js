'use strict';
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const usageRepo = require('../repositories/usageRepository');
const subRepo = require('../repositories/subscriptionRepository');
const { AppError } = require('../utils/errors');

const ACTIONS = new Set(['chat', 'scan', 'image_generation', 'rag_query', 'file_analysis']);

async function getPlanKey(userId) {
  const sub = await subRepo.ensureFree(userId);
  return subRepo.isProActive(sub) ? 'pro' : 'free';
}

async function limitFor(userId, action) {
  const plan = await getPlanKey(userId);
  const table = env.quotas[plan] || env.quotas.free;
  const lim = table[action];
  return lim === undefined ? env.quotas.free.chat : lim;
}

async function checkQuota(userId, action) {
  if (!ACTIONS.has(action)) {
    throw new AppError('Unknown usage action', 400, 'INVALID_ACTION');
  }
  const limit = await limitFor(userId, action);
  const plan = await getPlanKey(userId);
  if (limit === 0) {
    return {
      allowed: true,
      used: await usageRepo.sumToday(userId, action),
      limit: 0,
      remaining: null,
      plan,
    };
  }
  const used = await usageRepo.sumToday(userId, action);
  const remaining = Math.max(0, limit - used);
  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    plan,
  };
}

async function assertAllowed(userId, action) {
  const q = await checkQuota(userId, action);
  if (!q.allowed) {
    const err = new AppError(
      'Daily free limit reached. Upgrade to Pro to continue.',
      403,
      'QUOTA_EXCEEDED'
    );
    err.quota = q;
    throw err;
  }
  return q;
}

async function recordUsage(userId, action, units = 1, metadata = {}) {
  if (!ACTIONS.has(action)) throw new AppError('Unknown usage action', 400, 'INVALID_ACTION');
  await usageRepo.record({
    id: uuidv4(),
    userId,
    action,
    units: Math.max(1, Number(units) || 1),
    metadata,
    createdAt: Date.now(),
  });
  return checkQuota(userId, action);
}

async function snapshot(userId) {
  const actions = [...ACTIONS];
  const plan = await getPlanKey(userId);
  const items = {};
  for (const a of actions) {
    items[a] = await checkQuota(userId, a);
  }
  return { plan, items };
}

module.exports = { checkQuota, assertAllowed, recordUsage, snapshot, ACTIONS };
