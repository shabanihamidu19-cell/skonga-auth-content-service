'use strict';
const db = require('../config/db');

async function create({ id, email, passwordHash, name, now }) {
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    [id, email.toLowerCase(), passwordHash, name || '', now, now]
  );
  return findById(id);
}

async function findById(id) {
  return (await db.get('SELECT * FROM users WHERE id = ?', [id])) || null;
}

async function findByEmail(email) {
  return (
    (await db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [
      String(email || '').toLowerCase(),
    ])) || null
  );
}

async function listUsers({ limit = 100, offset = 0 } = {}) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const off = Math.max(0, Number(offset) || 0);
  try {
    return await db.all(
      `SELECT id, email, name, status, created_at, updated_at
       FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [lim, off]
    );
  } catch {
    return [];
  }
}

async function countUsers() {
  try {
    const row = await db.get('SELECT COUNT(*) AS n FROM users');
    return row ? Number(row.n) : 0;
  } catch {
    return 0;
  }
}

async function ensureShadowUser(userId, { email, name } = {}) {
  if (!userId || typeof userId !== 'string') return null;
  const id = userId.slice(0, 128);
  const existing = await findById(id);
  if (existing) return existing;
  const now = Date.now();
  const safeEmail =
    email && String(email).includes('@')
      ? String(email).toLowerCase()
      : `fb_${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}@firebase.local`;
  try {
    return await create({
      id,
      email: safeEmail.slice(0, 180),
      passwordHash: 'FIREBASE_SHADOW_NO_PASSWORD',
      name: (name || '').slice(0, 80),
      now,
    });
  } catch {
    return (await findById(id)) || (await findByEmail(safeEmail));
  }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  create,
  findById,
  findByEmail,
  listUsers,
  countUsers,
  ensureShadowUser,
  publicUser,
};
