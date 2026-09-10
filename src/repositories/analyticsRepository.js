'use strict';
/**
 * Analytics queries over existing users + usage_events tables.
 * No new tables. Works on postgres and node:sqlite.
 * JSON driver: returns zeros (limited query support).
 */
const db = require('../config/db');

function startOfUtcDay(ts = Date.now()) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysAgoMs(n) {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

async function safeGet(sql, params) {
  try {
    return (await db.get(sql, params)) || null;
  } catch (err) {
    console.warn('[analytics] query failed:', err.message);
    return null;
  }
}

async function safeAll(sql, params) {
  try {
    return (await db.all(sql, params)) || [];
  } catch (err) {
    console.warn('[analytics] query failed:', err.message);
    return [];
  }
}

async function countUsers() {
  const row = await safeGet('SELECT COUNT(*) AS n FROM users');
  return row ? Number(row.n) || 0 : 0;
}

/** Users whose created_at is on or after sinceMs */
async function countUsersCreatedSince(sinceMs) {
  const row = await safeGet(
    'SELECT COUNT(*) AS n FROM users WHERE created_at >= ?',
    [sinceMs]
  );
  return row ? Number(row.n) || 0 : 0;
}

/** Distinct users with any usage_events since sinceMs */
async function countActiveUsersSince(sinceMs) {
  const row = await safeGet(
    `SELECT COUNT(DISTINCT user_id) AS n
     FROM usage_events
     WHERE created_at >= ?`,
    [sinceMs]
  );
  return row ? Number(row.n) || 0 : 0;
}

/** Sum of units for one action since sinceMs (null sinceMs = all time) */
async function sumUnits(action, sinceMs = null) {
  if (sinceMs == null) {
    const row = await safeGet(
      `SELECT COALESCE(SUM(units), 0) AS total
       FROM usage_events WHERE action = ?`,
      [action]
    );
    return row ? Number(row.total) || 0 : 0;
  }
  const row = await safeGet(
    `SELECT COALESCE(SUM(units), 0) AS total
     FROM usage_events WHERE action = ? AND created_at >= ?`,
    [action, sinceMs]
  );
  return row ? Number(row.total) || 0 : 0;
}

/** Distinct users who performed action since sinceMs */
async function countUsersForAction(action, sinceMs) {
  const row = await safeGet(
    `SELECT COUNT(DISTINCT user_id) AS n
     FROM usage_events
     WHERE action = ? AND created_at >= ?`,
    [action, sinceMs]
  );
  return row ? Number(row.n) || 0 : 0;
}

/** Breakdown of units by action (all time + today) */
async function usageByAction() {
  const todayStart = startOfUtcDay();
  const actions = ['chat', 'scan', 'image_generation', 'rag_query', 'file_analysis'];
  const out = {};
  for (const action of actions) {
    const [total, today, usersToday] = await Promise.all([
      sumUnits(action, null),
      sumUnits(action, todayStart),
      countUsersForAction(action, todayStart),
    ]);
    out[action] = { total, today, usersToday };
  }
  return out;
}

module.exports = {
  startOfUtcDay,
  daysAgoMs,
  countUsers,
  countUsersCreatedSince,
  countActiveUsersSince,
  sumUnits,
  countUsersForAction,
  usageByAction,
};
