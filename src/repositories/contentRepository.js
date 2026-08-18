'use strict';
const db = require('../config/db');

function create(row) {
  db.prepare(
    `INSERT INTO content
     (id, user_id, type, title, body, metadata, storage_key, mime_type, size, created_at, updated_at)
     VALUES (@id, @user_id, @type, @title, @body, @metadata, @storage_key, @mime_type, @size, @created_at, @updated_at)`
  ).run(row);
  return findById(row.id);
}

function findById(id) {
  return db.prepare('SELECT * FROM content WHERE id = ?').get(id) || null;
}

function listByUser(userId, { limit = 50, offset = 0 } = {}) {
  return db
    .prepare(
      `SELECT * FROM content WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(userId, limit, offset);
}

function remove(id, userId) {
  return db.prepare('DELETE FROM content WHERE id = ? AND user_id = ?').run(id, userId);
}

function toPublic(row) {
  if (!row) return null;
  let metadata = {};
  try { metadata = JSON.parse(row.metadata || '{}'); } catch { metadata = {}; }
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    metadata,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { create, findById, listByUser, remove, toPublic };
