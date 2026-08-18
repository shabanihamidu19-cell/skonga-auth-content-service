'use strict';
const db = require('../config/db');

function create({ id, email, passwordHash, name, now }) {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`
  ).run(id, email.toLowerCase(), passwordHash, name || '', now, now);
  return findById(id);
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) || null;
}

/**
 * Firebase (or any external) UID → local user row so quotas/FK work.
 * password_hash is a placeholder; login still goes through Firebase.
 */
function ensureShadowUser(userId, { email, name } = {}) {
  if (!userId || typeof userId !== 'string') return null;
  const id = userId.slice(0, 128);
  const existing = findById(id);
  if (existing) return existing;
  const now = Date.now();
  const safeEmail =
    (email && String(email).includes('@')
      ? String(email).toLowerCase()
      : `fb_${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}@firebase.local`);
  try {
    return create({
      id,
      email: safeEmail.slice(0, 180),
      passwordHash: 'FIREBASE_SHADOW_NO_PASSWORD',
      name: (name || '').slice(0, 80),
      now,
    });
  } catch (err) {
    // race / unique email
    return findById(id) || findByEmail(safeEmail);
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

module.exports = { create, findById, findByEmail, ensureShadowUser, publicUser };
