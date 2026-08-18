'use strict';
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function getByUserId(userId) {
  return db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) || null;
}

function ensureFree(userId) {
  const existing = getByUserId(userId);
  if (existing) return existing;
  const now = Date.now();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO subscriptions (id, user_id, plan, status, started_at, expires_at, updated_at)
     VALUES (?, ?, 'free', 'active', ?, NULL, ?)`
  ).run(id, userId, now, now);
  return getByUserId(userId);
}

function setPro(userId, { plan = 'pro', days = 30 } = {}) {
  const now = Date.now();
  const expires = now + days * 24 * 60 * 60 * 1000;
  const existing = getByUserId(userId);
  if (existing) {
    db.prepare(
      `UPDATE subscriptions SET plan = ?, status = 'active', expires_at = ?, updated_at = ?
       WHERE user_id = ?`
    ).run(plan, expires, now, userId);
  } else {
    db.prepare(
      `INSERT INTO subscriptions (id, user_id, plan, status, started_at, expires_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`
    ).run(uuidv4(), userId, plan, now, expires, now);
  }
  return getByUserId(userId);
}

function isProActive(row) {
  if (!row) return false;
  if (row.status !== 'active') return false;
  if (row.plan === 'free') return false;
  if (row.expires_at && Date.now() > row.expires_at) return false;
  return true;
}

module.exports = { getByUserId, ensureFree, setPro, isProActive };
