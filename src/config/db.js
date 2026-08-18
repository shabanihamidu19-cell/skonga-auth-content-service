'use strict';
/**
 * DB — NO better-sqlite3 (fails on Termux Android arm).
 * 1) node:sqlite if available (Node 22+)
 * 2) pure JSON file fallback (always works on Termux)
 */
const fs = require('fs');
const path = require('path');
const env = require('./env');

const dbPath = path.resolve(env.databasePath);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db = null;

function tryNodeSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  storage_key TEXT,
  mime_type TEXT,
  size INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_user ON content(user_id);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id, action, created_at);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  started_at INTEGER NOT NULL,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL
);
`);
  console.log('[db] node:sqlite →', dbPath);
  return {
    driver: 'node:sqlite',
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        run(...params) {
          // support object for named-style inserts from contentRepo
          if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
            const o = params[0];
            const r = stmt.run(o);
            return { changes: r.changes ?? 0 };
          }
          const r = stmt.run(...params);
          return { changes: r.changes ?? 0 };
        },
        get(...params) {
          return stmt.get(...params) || undefined;
        },
        all(...params) {
          return stmt.all(...params) || [];
        },
      };
    },
    exec(sql) {
      sqlite.exec(sql);
    },
  };
}

function jsonFallback() {
  const jsonPath = dbPath.replace(/\.sqlite$/i, '') + '.json';
  const empty = { users: [], content: [], usage_events: [], subscriptions: [] };

  function load() {
    try {
      if (fs.existsSync(jsonPath)) return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (_) {}
    return JSON.parse(JSON.stringify(empty));
  }
  function save(data) {
    fs.writeFileSync(jsonPath, JSON.stringify(data));
  }

  console.log('[db] JSON fallback →', jsonPath);
  return {
    driver: 'json',
    prepare(sql) {
      const s = sql.replace(/\s+/g, ' ').trim();
      return {
        run(...params) {
          const data = load();
          if (/^INSERT INTO users/i.test(s)) {
            const [id, email, password_hash, name, created_at, updated_at] = params;
            data.users.push({
              id, email, password_hash, name: name || '', status: 'active', created_at, updated_at,
            });
            save(data);
            return { changes: 1 };
          }
          if (/^INSERT INTO content/i.test(s)) {
            const row = params[0] && typeof params[0] === 'object' ? params[0] : null;
            if (row) data.content.push(Object.assign({}, row));
            save(data);
            return { changes: 1 };
          }
          if (/^INSERT INTO usage_events/i.test(s)) {
            const [id, user_id, action, units, metadata, created_at] = params;
            data.usage_events.push({ id, user_id, action, units, metadata, created_at });
            save(data);
            return { changes: 1 };
          }
          if (/^INSERT INTO subscriptions/i.test(s)) {
            if (s.includes("'free'")) {
              const [id, user_id, started_at, updated_at] = params;
              data.subscriptions.push({
                id, user_id, plan: 'free', status: 'active',
                started_at, expires_at: null, updated_at,
              });
            } else {
              const [id, user_id, plan, started_at, expires_at, updated_at] = params;
              data.subscriptions.push({
                id, user_id, plan, status: 'active', started_at, expires_at, updated_at,
              });
            }
            save(data);
            return { changes: 1 };
          }
          if (/^UPDATE subscriptions/i.test(s)) {
            const [plan, expires_at, updated_at, user_id] = params;
            const row = data.subscriptions.find((x) => x.user_id === user_id);
            if (row) {
              row.plan = plan;
              row.status = 'active';
              row.expires_at = expires_at;
              row.updated_at = updated_at;
              save(data);
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          if (/^DELETE FROM content/i.test(s)) {
            const [id, user_id] = params;
            const before = data.content.length;
            data.content = data.content.filter((c) => !(c.id === id && c.user_id === user_id));
            save(data);
            return { changes: before - data.content.length };
          }
          return { changes: 0 };
        },
        get(...params) {
          const data = load();
          if (/FROM users WHERE id/i.test(s)) return data.users.find((u) => u.id === params[0]);
          if (/FROM users WHERE email/i.test(s)) {
            const e = String(params[0] || '').toLowerCase();
            return data.users.find((u) => String(u.email).toLowerCase() === e);
          }
          if (/FROM content WHERE id/i.test(s)) return data.content.find((c) => c.id === params[0]);
          if (/FROM subscriptions WHERE user_id/i.test(s)) {
            return data.subscriptions.find((x) => x.user_id === params[0]);
          }
          if (/SUM\(units\)/i.test(s)) {
            const [userId, action, start] = params;
            const total = data.usage_events
              .filter((e) => e.user_id === userId && e.action === action && e.created_at >= start)
              .reduce((a, e) => a + (Number(e.units) || 0), 0);
            return { total };
          }
          return undefined;
        },
        all(...params) {
          const data = load();
          if (/FROM content WHERE user_id/i.test(s)) {
            const [userId, limit, offset] = params;
            return data.content
              .filter((c) => c.user_id === userId)
              .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
              .slice(offset, offset + limit);
          }
          return [];
        },
      };
    },
    exec() {},
  };
}

try {
  db = tryNodeSqlite();
} catch (err) {
  console.warn('[db] node:sqlite unavailable:', err.message);
  db = jsonFallback();
}

module.exports = db;
