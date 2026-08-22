'use strict';
const { v4: uuidv4 } = require('uuid');
const contentRepo = require('../repositories/contentRepository');
const { AppError } = require('../utils/errors');

const ALLOWED_TYPES = new Set(['chat', 'note', 'image', 'scan', 'file']);

async function createContent(userId, { type, title, body, metadata, storageKey, mimeType, size }) {
  if (!ALLOWED_TYPES.has(type)) {
    throw new AppError('Invalid content type', 400, 'INVALID_TYPE');
  }
  const now = Date.now();
  const row = await contentRepo.create({
    id: uuidv4(),
    user_id: userId,
    type,
    title: String(title || '').slice(0, 200),
    body: String(body || '').slice(0, 200000),
    metadata: JSON.stringify(metadata || {}),
    storage_key: storageKey || null,
    mime_type: mimeType || null,
    size: size || null,
    created_at: now,
    updated_at: now,
  });
  return contentRepo.toPublic(row);
}

async function listContent(userId, query) {
  const limit = Math.min(Number(query.limit) || 50, 100);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const rows = await contentRepo.listByUser(userId, { limit, offset });
  return rows.map(contentRepo.toPublic);
}

async function getContent(userId, id) {
  const row = await contentRepo.findById(id);
  if (!row || row.user_id !== userId) throw new AppError('Content not found', 404, 'NOT_FOUND');
  return contentRepo.toPublic(row);
}

async function deleteContent(userId, id) {
  const result = await contentRepo.remove(id, userId);
  if (!result.changes) throw new AppError('Content not found', 404, 'NOT_FOUND');
  return { ok: true };
}

module.exports = { createContent, listContent, getContent, deleteContent };
