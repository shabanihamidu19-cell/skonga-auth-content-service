'use strict';
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

const DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS learning_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  form_level TEXT NOT NULL DEFAULT '',
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  mastery INTEGER NOT NULL DEFAULT 0,
  last_result INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_learn_user ON learning_progress(user_id, subject);
`;

const DDL_PG = `
CREATE TABLE IF NOT EXISTS learning_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  form_level TEXT NOT NULL DEFAULT '',
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  mastery INTEGER NOT NULL DEFAULT 0,
  last_result INTEGER,
  updated_at BIGINT NOT NULL,
  UNIQUE(user_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_learn_user ON learning_progress(user_id, subject);
`;

let migrated = false;

async function ensureSchema() {
  if (migrated) return;
  await db.ready;
  if (db.driver === 'postgres') {
    // run each statement — pool.query accepts multi in PG
    await db.run(
      `CREATE TABLE IF NOT EXISTS learning_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        form_level TEXT NOT NULL DEFAULT '',
        correct_count INTEGER NOT NULL DEFAULT 0,
        wrong_count INTEGER NOT NULL DEFAULT 0,
        mastery INTEGER NOT NULL DEFAULT 0,
        last_result INTEGER,
        updated_at BIGINT NOT NULL,
        UNIQUE(user_id, topic_id)
      )`
    );
    try {
      await db.run(`CREATE INDEX IF NOT EXISTS idx_learn_user ON learning_progress(user_id, subject)`);
    } catch (_) {}
  } else if (db.driver === 'node:sqlite') {
    // exec via multiple runs
    await db.run(
      `CREATE TABLE IF NOT EXISTS learning_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        form_level TEXT NOT NULL DEFAULT '',
        correct_count INTEGER NOT NULL DEFAULT 0,
        wrong_count INTEGER NOT NULL DEFAULT 0,
        mastery INTEGER NOT NULL DEFAULT 0,
        last_result INTEGER,
        updated_at INTEGER NOT NULL,
        UNIQUE(user_id, topic_id)
      )`
    );
    try {
      await db.run(`CREATE INDEX IF NOT EXISTS idx_learn_user ON learning_progress(user_id, subject)`);
    } catch (_) {}
  }
  migrated = true;
}

async function find(userId, topicId) {
  await ensureSchema();
  return (
    (await db.get(
      'SELECT * FROM learning_progress WHERE user_id = ? AND topic_id = ?',
      [userId, topicId]
    )) || null
  );
}

async function listByUser(userId, subject) {
  await ensureSchema();
  if (subject) {
    return db.all(
      'SELECT * FROM learning_progress WHERE user_id = ? AND subject = ? ORDER BY updated_at DESC',
      [userId, subject]
    );
  }
  return db.all(
    'SELECT * FROM learning_progress WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
}

/**
 * Record practice result. mastery 0–3 (simple ladder).
 */
async function recordResult(userId, { topicId, subject, formLevel, correct }) {
  await ensureSchema();
  const now = Date.now();
  const existing = await find(userId, topicId);
  const isCorrect = !!correct;

  if (!existing) {
    const mastery = isCorrect ? 1 : 0;
    const id = uuidv4();
    await db.run(
      `INSERT INTO learning_progress
       (id, user_id, topic_id, subject, form_level, correct_count, wrong_count, mastery, last_result, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        topicId,
        subject || '',
        formLevel || '',
        isCorrect ? 1 : 0,
        isCorrect ? 0 : 1,
        mastery,
        isCorrect ? 1 : 0,
        now,
      ]
    );
    return find(userId, topicId);
  }

  let correct_count = Number(existing.correct_count) || 0;
  let wrong_count = Number(existing.wrong_count) || 0;
  let mastery = Number(existing.mastery) || 0;
  if (isCorrect) {
    correct_count += 1;
    mastery = Math.min(3, mastery + 1);
  } else {
    wrong_count += 1;
    mastery = Math.max(0, mastery - 1);
  }

  await db.run(
    `UPDATE learning_progress SET
      subject = ?, form_level = ?, correct_count = ?, wrong_count = ?,
      mastery = ?, last_result = ?, updated_at = ?
     WHERE user_id = ? AND topic_id = ?`,
    [
      subject || existing.subject || '',
      formLevel || existing.form_level || '',
      correct_count,
      wrong_count,
      mastery,
      isCorrect ? 1 : 0,
      now,
      userId,
      topicId,
    ]
  );
  return find(userId, topicId);
}

module.exports = { ensureSchema, find, listByUser, recordResult };
