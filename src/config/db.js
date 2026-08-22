'use strict';
/**
 * Drivers:
 * 1) DATABASE_URL (postgres) — durable production
 * 2) node:sqlite — local / tests
 * 3) JSON file — Termux fallback
 *
 * API: await db.run / db.get / db.all  (+ db.ready, db.driver)
 */
const fs = require('fs');
const path = require('path');
const env = require('./env');

const SCHEMA_SQLITE = `
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
`;

const SCHEMA_PG = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
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
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_user ON content(user_id);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id, action, created_at);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  started_at BIGINT NOT NULL,
  expires_at BIGINT,
  updated_at BIGINT NOT NULL
);
`;

function namedToPositional(sql, obj) {
  const names = [];
  const out = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, n) => {
    names.push(n);
    return '?';
  });
  return { sql: out, params: names.map((n) => obj[n]) };
}

function qMarksToPg(sql) {
  let i = 0;
  return sql.replace(/COLLATE\s+NOCASE/gi, '').replace(/\?/g, () => `$${++i}`);
}

let impl = null;

async function initPg(url) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    ssl:
      /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    max: 5,
  });
  await pool.query(SCHEMA_PG);
  console.log('[db] postgres ← DATABASE_URL');
  return {
    driver: 'postgres',
    async run(sql, params) {
      let s = sql;
      let p = params || [];
      if (p.length === 1 && p[0] && typeof p[0] === 'object' && !Array.isArray(p[0])) {
        const c = namedToPositional(sql, p[0]);
        s = c.sql;
        p = c.params;
      }
      const r = await pool.query(qMarksToPg(s), p);
      return { changes: r.rowCount || 0 };
    },
    async get(sql, params) {
      const r = await pool.query(qMarksToPg(sql), params || []);
      return r.rows[0] || null;
    },
    async all(sql, params) {
      const r = await pool.query(qMarksToPg(sql), params || []);
      return r.rows;
    },
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },
  };
}

function initSqlite() {
  const dbPath = path.resolve(env.databasePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(SCHEMA_SQLITE);
  console.log('[db] node:sqlite →', dbPath);
  return {
    driver: 'node:sqlite',
    async run(sql, params) {
      const stmt = sqlite.prepare(sql);
      const p = params || [];
      if (p.length === 1 && p[0] && typeof p[0] === 'object' && !Array.isArray(p[0])) {
        const r = stmt.run(p[0]);
        return { changes: r.changes ?? 0 };
      }
      const r = stmt.run(...p);
      return { changes: r.changes ?? 0 };
    },
    async get(sql, params) {
      return sqlite.prepare(sql).get(...(params || [])) || null;
    },
    async all(sql, params) {
      return sqlite.prepare(sql).all(...(params || [])) || [];
    },
    async ping() {
      sqlite.prepare('SELECT 1').get();
      return true;
    },
  };
}

function initJson() {
  const dbPath = path.resolve(env.databasePath.replace(/\.sqlite$/i, '.json'));
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(
      dbPath,
      JSON.stringify({ users: [], content: [], usage_events: [], subscriptions: [] })
    );
  }
  const load = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const save = (d) => fs.writeFileSync(dbPath, JSON.stringify(d));
  console.log('[db] json →', dbPath);
  return {
    driver: 'json',
    async run(sql, params) {
      const data = load();
      const s = sql.replace(/\s+/g, ' ');
      const p = params || [];
      if (/INSERT INTO users/i.test(s)) {
        const [id, email, password_hash, name, created_at, updated_at] = p;
        data.users.push({
          id,
          email,
          password_hash,
          name: name || '',
          status: 'active',
          created_at,
          updated_at,
        });
        save(data);
        return { changes: 1 };
      }
      if (/INSERT INTO subscriptions/i.test(s) && s.includes("'free'")) {
        data.subscriptions.push({
          id: p[0],
          user_id: p[1],
          plan: 'free',
          status: 'active',
          started_at: p[2],
          expires_at: null,
          updated_at: p[3],
        });
        save(data);
        return { changes: 1 };
      }
      if (/INSERT INTO subscriptions/i.test(s)) {
        data.subscriptions.push({
          id: p[0],
          user_id: p[1],
          plan: p[2],
          status: 'active',
          started_at: p[3],
          expires_at: p[4],
          updated_at: p[5],
        });
        save(data);
        return { changes: 1 };
      }
      if (/UPDATE subscriptions/i.test(s)) {
        const row = data.subscriptions.find((x) => x.user_id === p[3]);
        if (row) {
          row.plan = p[0];
          row.status = 'active';
          row.expires_at = p[1];
          row.updated_at = p[2];
          save(data);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (/INSERT INTO usage_events/i.test(s)) {
        data.usage_events.push({
          id: p[0],
          user_id: p[1],
          action: p[2],
          units: p[3],
          metadata: p[4],
          created_at: p[5],
        });
        save(data);
        return { changes: 1 };
      }
      if (/INSERT INTO content/i.test(s)) {
        data.content.push({ ...(p[0] || {}) });
        save(data);
        return { changes: 1 };
      }
      if (/DELETE FROM content/i.test(s)) {
        const before = data.content.length;
        data.content = data.content.filter((c) => !(c.id === p[0] && c.user_id === p[1]));
        save(data);
        return { changes: before - data.content.length };
      }
      return { changes: 0 };
    },
    async get(sql, params) {
      const data = load();
      const s = sql.replace(/\s+/g, ' ');
      const p = params || [];
      if (/FROM users WHERE id/i.test(s)) return data.users.find((u) => u.id === p[0]) || null;
      if (/FROM users WHERE email/i.test(s)) {
        const e = String(p[0] || '').toLowerCase();
        return data.users.find((u) => String(u.email).toLowerCase() === e) || null;
      }
      if (/FROM subscriptions WHERE user_id/i.test(s))
        return data.subscriptions.find((x) => x.user_id === p[0]) || null;
      if (/FROM content WHERE id/i.test(s)) return data.content.find((c) => c.id === p[0]) || null;
      if (/COUNT\(\*\).*users/i.test(s)) return { n: data.users.length };
      if (/SUM\(units\)/i.test(s)) {
        const total = data.usage_events
          .filter((e) => e.user_id === p[0] && e.action === p[1] && e.created_at >= p[2])
          .reduce((a, e) => a + Number(e.units || 0), 0);
        return { total };
      }
      return null;
    },
    async all(sql, params) {
      const data = load();
      const s = sql.replace(/\s+/g, ' ');
      const p = params || [];
      if (/FROM users ORDER BY created_at/i.test(s)) {
        return data.users
          .slice()
          .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
          .slice(p[1] || 0, (p[1] || 0) + (p[0] || 100))
          .map(({ password_hash, ...r }) => r);
      }
      if (/FROM content WHERE user_id/i.test(s)) {
        return data.content
          .filter((c) => c.user_id === p[0])
          .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
          .slice(p[2] || 0, (p[2] || 0) + (p[1] || 50));
      }
      return [];
    },
    async ping() {
      return true;
    },
  };
}

async function boot() {
  if (env.databaseUrl && /^postgres(ql)?:\/\//i.test(env.databaseUrl)) {
    impl = await initPg(env.databaseUrl);
  } else {
    try {
      impl = initSqlite();
    } catch (e) {
      console.warn('[db] node:sqlite unavailable:', e.message);
      impl = initJson();
    }
  }
  return impl;
}

const ready = boot().catch((e) => {
  console.error('[db] init failed', e);
  process.exit(1);
});

module.exports = {
  ready,
  get driver() {
    return impl ? impl.driver : 'starting';
  },
  async run(sql, params) {
    await ready;
    return impl.run(sql, params);
  },
  async get(sql, params) {
    await ready;
    return impl.get(sql, params);
  },
  async all(sql, params) {
    await ready;
    return impl.all(sql, params);
  },
  async ping() {
    await ready;
    return impl.ping();
  },
};
