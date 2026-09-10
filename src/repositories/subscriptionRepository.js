'use strict';
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function getByUserId(userId) {
  return (await db.get('SELECT * FROM subscriptions WHERE user_id = ?', [userId])) || null;
}

async function ensureFree(userId) {
  const existing = await getByUserId(userId);
  if (existing) return existing;
  const now = Date.now();
  const id = uuidv4();
  await db.run(
    `INSERT INTO subscriptions (id, user_id, plan, status, started_at, expires_at, updated_at)
     VALUES (?, ?, 'free', 'active', ?, NULL, ?)`,
    [id, userId, now, now]
  );
  return getByUserId(userId);
}

/**
 * Grant or extend Pro.
 * @param {string} userId
 * @param {{ plan?: string, days?: number, expiresAt?: number|null }} opts
 *   - expiresAt: absolute ms (from payment backend) — preferred when syncing
 *   - days: relative duration; stacks on top of current active Pro if any
 */
async function setPro(userId, { plan = 'pro', days = 30, expiresAt = null } = {}) {
  const now = Date.now();
  const existing = await getByUserId(userId);
  let expires;

  if (expiresAt != null && Number(expiresAt) > 0) {
    expires = Number(expiresAt);
    // If local Pro already lasts longer, keep the later expiry
    if (existing && isProActive(existing) && Number(existing.expires_at) > expires) {
      expires = Number(existing.expires_at);
    }
  } else {
    const d = Math.max(1, Number(days) || 30);
    const base =
      existing && isProActive(existing) && existing.expires_at
        ? Number(existing.expires_at)
        : now;
    expires = base + d * 24 * 60 * 60 * 1000;
  }

  if (existing) {
    await db.run(
      `UPDATE subscriptions SET plan = ?, status = 'active', expires_at = ?, updated_at = ?
       WHERE user_id = ?`,
      [plan, expires, now, userId]
    );
  } else {
    await db.run(
      `INSERT INTO subscriptions (id, user_id, plan, status, started_at, expires_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      [uuidv4(), userId, plan, now, expires, now]
    );
  }
  return getByUserId(userId);
}

function isProActive(row) {
  if (!row) return false;
  if (row.status !== 'active') return false;
  if (row.plan === 'free') return false;
  if (row.expires_at && Date.now() > Number(row.expires_at)) return false;
  return true;
}

function publicSub(row) {
  if (!row) return null;
  const active = isProActive(row);
  return {
    plan: active ? row.plan : 'free',
    status: row.status,
    active,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    daysLeft:
      active && row.expires_at
        ? Math.max(0, Math.ceil((Number(row.expires_at) - Date.now()) / 86400000))
        : 0,
  };
}

module.exports = { getByUserId, ensureFree, setPro, isProActive, publicSub };
