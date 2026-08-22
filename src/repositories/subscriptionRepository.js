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

async function setPro(userId, { plan = 'pro', days = 30 } = {}) {
  const now = Date.now();
  const expires = now + days * 24 * 60 * 60 * 1000;
  const existing = await getByUserId(userId);
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

module.exports = { getByUserId, ensureFree, setPro, isProActive };
