'use strict';
/**
 * Phase 4 — Pro synchronization.
 * AI/payment backend calls these after successful mobile-money payment
 * so quotas (usageService) see plan=pro.
 */
const userRepo = require('../repositories/userRepository');
const subRepo = require('../repositories/subscriptionRepository');

async function ensureIdentity(userId, { email, name } = {}) {
  await userRepo.ensureShadowUser(String(userId), { email, name });
  await subRepo.ensureFree(String(userId));
}

/**
 * POST /api/internal/pro/grant
 * Body: { userId, days?, planId?, expiresAt?, orderId?, email?, name? }
 */
async function grant(req, res, next) {
  try {
    const body = req.body || {};
    const userId = body.userId ? String(body.userId).slice(0, 128) : '';
    if (!userId) {
      return res.status(400).json({ error: 'userId required', code: 'BAD_REQUEST' });
    }

    await ensureIdentity(userId, { email: body.email, name: body.name });

    const days = body.days != null ? Number(body.days) : 30;
    const expiresAt = body.expiresAt != null ? Number(body.expiresAt) : null;
    const planLabel = body.planId ? `pro_${String(body.planId).slice(0, 16)}` : 'pro';

    const row = await subRepo.setPro(userId, {
      plan: planLabel.startsWith('pro') ? planLabel : 'pro',
      days: Number.isFinite(days) ? days : 30,
      expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null,
    });

    const pub = subRepo.publicSub(row);
    res.json({
      ok: true,
      userId,
      orderId: body.orderId || null,
      subscription: pub,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/internal/pro/status?userId=
 */
async function status(req, res, next) {
  try {
    const userId = (req.query.userId || req.body?.userId || '').toString().slice(0, 128);
    if (!userId) {
      return res.status(400).json({ error: 'userId required', code: 'BAD_REQUEST' });
    }
    await ensureIdentity(userId);
    const row = await subRepo.getByUserId(userId);
    res.json({
      ok: true,
      userId,
      subscription: subRepo.publicSub(row),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { grant, status };
