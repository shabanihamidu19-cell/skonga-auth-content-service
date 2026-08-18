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

module.exports = { create, findById, findByEmail, publicUser };
