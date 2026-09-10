'use strict';
/**
 * Analytics queries over existing users + usage_events tables.
 * No new tables. Works on postgres and node:sqlite.
 * JSON driver: returns zeros (limited query support).
 */
const db = require('../config/db');

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(ts = Date.now()) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysAgoMs(n) {
  return Date.now() - n * MS_DAY;
}

function dayKeyFromMs(ms) {
  return new Date(startOfUtcDay(ms)).toISOString().slice(0, 10);
}

function fillDaySeries(sinceMs, untilMs, map) {
  const out = [];
  let t = startOfUtcDay(sinceMs);
  const end = startOfUtcDay(untilMs);
  while (t <= end) {
    const key = dayKeyFromMs(t);
    out.push({ date: key, value: map.get(key) || 0 });
    t += MS_DAY;
  }
  return out;
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

async function countUsersCreatedSince(sinceMs) {
  const row = await safeGet(
    'SELECT COUNT(*) AS n FROM users WHERE created_at >= ?',
    [sinceMs]
  );
  return row ? Number(row.n) || 0 : 0;
}

async function countActiveUsersSince(sinceMs) {
  const row = await safeGet(
    `SELECT COUNT(DISTINCT user_id) AS n
     FROM usage_events
     WHERE created_at >= ?`,
    [sinceMs]
  );
  return row ? Number(row.n) || 0 : 0;
}

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

async function countUsersForAction(action, sinceMs) {
  const row = await safeGet(
    `SELECT COUNT(DISTINCT user_id) AS n
     FROM usage_events
     WHERE action = ? AND created_at >= ?`,
    [action, sinceMs]
  );
  return row ? Number(row.n) || 0 : 0;
}

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

/**
 * New signups per UTC day for the last `days` days (inclusive of today).
 * day_bucket = floor(created_at / 86400000) — works on SQLite + Postgres.
 */
async function newUsersByDay(days = 30) {
  const n = Math.min(90, Math.max(1, Number(days) || 30));
  const since = startOfUtcDay(daysAgoMs(n - 1));
  const rows = await safeAll(
    `SELECT CAST(created_at / 86400000 AS INTEGER) AS day_bucket,
            COUNT(*) AS n
     FROM users
     WHERE created_at >= ?
     GROUP BY CAST(created_at / 86400000 AS INTEGER)
     ORDER BY day_bucket ASC`,
    [since]
  );
  const map = new Map();
  for (const r of rows) {
    const ms = Number(r.day_bucket) * MS_DAY;
    map.set(dayKeyFromMs(ms), Number(r.n) || 0);
  }
  return fillDaySeries(since, Date.now(), map);
}

/** Distinct active users (any usage) per UTC day */
async function activeUsersByDay(days = 30) {
  const n = Math.min(90, Math.max(1, Number(days) || 30));
  const since = startOfUtcDay(daysAgoMs(n - 1));
  const rows = await safeAll(
    `SELECT CAST(created_at / 86400000 AS INTEGER) AS day_bucket,
            COUNT(DISTINCT user_id) AS n
     FROM usage_events
     WHERE created_at >= ?
     GROUP BY CAST(created_at / 86400000 AS INTEGER)
     ORDER BY day_bucket ASC`,
    [since]
  );
  const map = new Map();
  for (const r of rows) {
    const ms = Number(r.day_bucket) * MS_DAY;
    map.set(dayKeyFromMs(ms), Number(r.n) || 0);
  }
  return fillDaySeries(since, Date.now(), map);
}

/** Units summed per day for one action (or all if action is null/'all') */
async function usageUnitsByDay(days = 30, action = null) {
  const n = Math.min(90, Math.max(1, Number(days) || 30));
  const since = startOfUtcDay(daysAgoMs(n - 1));
  let rows;
  if (action && action !== 'all') {
    rows = await safeAll(
      `SELECT CAST(created_at / 86400000 AS INTEGER) AS day_bucket,
              COALESCE(SUM(units), 0) AS total
       FROM usage_events
       WHERE created_at >= ? AND action = ?
       GROUP BY CAST(created_at / 86400000 AS INTEGER)
       ORDER BY day_bucket ASC`,
      [since, action]
    );
  } else {
    rows = await safeAll(
      `SELECT CAST(created_at / 86400000 AS INTEGER) AS day_bucket,
              COALESCE(SUM(units), 0) AS total
       FROM usage_events
       WHERE created_at >= ?
       GROUP BY CAST(created_at / 86400000 AS INTEGER)
       ORDER BY day_bucket ASC`,
      [since]
    );
  }
  const map = new Map();
  for (const r of rows) {
    const ms = Number(r.day_bucket) * MS_DAY;
    map.set(dayKeyFromMs(ms), Number(r.total) || 0);
  }
  return fillDaySeries(since, Date.now(), map);
}

/** Units by action for a fixed window */
async function usageByActionSince(sinceMs) {
  const actions = ['chat', 'scan', 'image_generation', 'rag_query', 'file_analysis'];
  const out = {};
  for (const action of actions) {
    const [units, users] = await Promise.all([
      sumUnits(action, sinceMs),
      countUsersForAction(action, sinceMs),
    ]);
    out[action] = { units, users };
  }
  return out;
}

/**
 * Simple retention for signup cohorts over the last `cohortDays` days.
 * D1 = used product on calendar day after signup day
 * D7 = used product on day signup+7
 */
async function retentionCohorts(cohortDays = 14) {
  const n = Math.min(30, Math.max(1, Number(cohortDays) || 14));
  // Need signup through n+7 days ago for D7 to mature
  const since = startOfUtcDay(daysAgoMs(n + 7));
  const users = await safeAll(
    `SELECT id, created_at FROM users WHERE created_at >= ? ORDER BY created_at ASC`,
    [since]
  );
  if (!users.length) return [];

  const events = await safeAll(
    `SELECT user_id, created_at FROM usage_events WHERE created_at >= ?`,
    [since]
  );
  const activityByUser = new Map();
  for (const e of events) {
    const day = startOfUtcDay(Number(e.created_at));
    if (!activityByUser.has(e.user_id)) activityByUser.set(e.user_id, new Set());
    activityByUser.get(e.user_id).add(day);
  }

  const cohorts = new Map();
  for (const u of users) {
    const signupDay = startOfUtcDay(Number(u.created_at));
    const key = dayKeyFromMs(signupDay);
    if (!cohorts.has(key)) {
      cohorts.set(key, { date: key, size: 0, d1: 0, d7: 0 });
    }
    const c = cohorts.get(key);
    c.size += 1;
    const days = activityByUser.get(u.id);
    if (days) {
      if (days.has(signupDay + MS_DAY)) c.d1 += 1;
      if (days.has(signupDay + 7 * MS_DAY)) c.d7 += 1;
    }
  }

  const today = startOfUtcDay();
  return Array.from(cohorts.values())
    .map((c) => {
      const cohortDay = Date.parse(c.date + 'T00:00:00.000Z');
      const d1Mature = today >= cohortDay + MS_DAY;
      const d7Mature = today >= cohortDay + 7 * MS_DAY;
      return {
        date: c.date,
        size: c.size,
        d1Returned: c.d1,
        d7Returned: c.d7,
        d1Rate: d1Mature && c.size ? Number(((c.d1 / c.size) * 100).toFixed(1)) : null,
        d7Rate: d7Mature && c.size ? Number(((c.d7 / c.size) * 100).toFixed(1)) : null,
        d1Mature,
        d7Mature,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
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
  newUsersByDay,
  activeUsersByDay,
  usageUnitsByDay,
  usageByActionSince,
  retentionCohorts,
};
