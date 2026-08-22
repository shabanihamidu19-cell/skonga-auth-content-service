'use strict';
const db = require('../config/db');

async function record({ id, userId, action, units, metadata, createdAt }) {
  await db.run(
    `INSERT INTO usage_events (id, user_id, action, units, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, action, units, JSON.stringify(metadata || {}), createdAt]
  );
}

async function sumToday(userId, action) {
  const start = startOfUtcDay(Date.now());
  const row = await db.get(
    `SELECT COALESCE(SUM(units), 0) AS total
     FROM usage_events
     WHERE user_id = ? AND action = ? AND created_at >= ?`,
    [userId, action, start]
  );
  return row ? Number(row.total) : 0;
}

function startOfUtcDay(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

module.exports = { record, sumToday, startOfUtcDay };
