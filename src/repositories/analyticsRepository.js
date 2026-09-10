'use strict';
/**
 * analyticsRepository.js
 * Read-only aggregates from existing users + usage_events tables.
 * No new tables. Works on postgres + node:sqlite (JSON driver returns 0/empty).
 */
const db = require('../config/db');

function startOfUtcDay(ts = Date.now()) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function countUsers() {
  try {
    const row = await db.get('SELECT COUNT(*) AS n FROM users');
    return row ? Number(row.n) : 0;
  } catch {
    return 0;
  }
}

/** Users registered since `sinceMs` (inclusive). */
async function countNewUsers(sinceMs) {
  try {
    const row = await db.get(
      'SELECT COUNT(*) AS n FROM users WHERE created_at >= ?',
      [sinceMs]
    );
    return row ? Number(row.n) : 0;
  } catch {
    return 0;
  }
}

/** Distinct users with at least one usage event since `sinceMs`. */
async function countActiveUsers(sinceMs) {
  try {
    const row = await db.get(
      `SELECT COUNT(DISTINCT user_id) AS n
       FROM usage_events
       WHERE created_at >= ?`,
      [sinceMs]
    );
    return row ? Number(row.n) : 0;
  } catch {
    return 0;
  }
}

/** Sum of units for one action (optional lower bound on created_at). */
async function sumUnitsByAction(action, sinceMs = null) {
  try {
    if (sinceMs != null) {
      const row = await db.get(
        `SELECT COALESCE(SUM(units), 0) AS total
         FROM usage_events
         WHERE action = ? AND created_at >= ?`,
        [action, sinceMs]
      );
      return row ? Number(row.total) : 0;
    }
    const row = await db.get(
      `SELECT COALESCE(SUM(units), 0) AS total
       FROM usage_events
       WHERE action = ?`,
      [action]
    );
    return row ? Number(row.total) : 0;
  } catch {
    return 0;
  }
}

/** Totals for all known actions in one pass (postgres/sqlite). */
async function sumUnitsGrouped(sinceMs = null) {
  const out = {
    chat: 0,
    scan: 0,
    image_generation: 0,
    rag_query: 0,
    file_analysis: 0,
  };
  try {
    let rows;
    if (sinceMs != null) {
      rows = await db.all(
        `SELECT action, COALESCE(SUM(units), 0) AS total
         FROM usage_events
         WHERE created_at >= ?
         GROUP BY action`,
        [sinceMs]
      );
    } else {
      rows = await db.all(
        `SELECT action, COALESCE(SUM(units), 0) AS total
         FROM usage_events
         GROUP BY action`
      );
    }
    for (const r of rows || []) {
      const key = String(r.action || '');
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        out[key] = Number(r.total) || 0;
      }
    }
  } catch {
    /* keep zeros */
  }
  return out;
}

module.exports = {
  startOfUtcDay,
  countUsers,
  countNewUsers,
  countActiveUsers,
  sumUnitsByAction,
  sumUnitsGrouped,
};
