'use strict';
const progressRepo = require('../repositories/progressRepository');
const { listTopics, getTopic } = require('./learnCatalog');
const { AppError } = require('../utils/errors');

/**
 * Rules-based path (Phase 1):
 * 1) Prefer topics with mastery < 2 in catalog order
 * 2) Else lowest mastery (review)
 * 3) Else first catalog topic
 */
async function recordResult(userId, body) {
  const topicId = String(body.topicId || body.topic_id || '').trim();
  if (!topicId) throw new AppError('topicId required', 400, 'BAD_REQUEST');
  const meta = getTopic(topicId);
  const subject = String(body.subject || meta?.subject || '').toLowerCase();
  const formLevel = String(body.form || body.formLevel || meta?.form || '').toLowerCase();
  const correct = body.correct === true || body.correct === 1 || body.correct === '1';

  const row = await progressRepo.recordResult(userId, {
    topicId,
    subject,
    formLevel,
    correct,
  });

  return {
    topicId: row.topic_id,
    subject: row.subject,
    mastery: Number(row.mastery),
    correctCount: Number(row.correct_count),
    wrongCount: Number(row.wrong_count),
    lastCorrect: !!Number(row.last_result),
  };
}

async function getProgress(userId, { subject } = {}) {
  const rows = await progressRepo.listByUser(userId, subject ? String(subject).toLowerCase() : null);
  return rows.map((r) => ({
    topicId: r.topic_id,
    subject: r.subject,
    form: r.form_level,
    mastery: Number(r.mastery),
    correctCount: Number(r.correct_count),
    wrongCount: Number(r.wrong_count),
    updatedAt: r.updated_at,
  }));
}

async function nextTopic(userId, { subject, form } = {}) {
  const subj = subject ? String(subject).toLowerCase() : 'biology';
  const catalog = listTopics({ subject: subj, form });
  if (!catalog.length) {
    return { next: null, reason: 'no_topics', subject: subj };
  }

  const progress = await progressRepo.listByUser(userId, subj);
  const byId = Object.fromEntries(progress.map((p) => [p.topic_id, p]));

  // Path: first not-yet-mastered in order
  for (const t of catalog) {
    const p = byId[t.id];
    const mastery = p ? Number(p.mastery) : 0;
    if (mastery < 2) {
      return {
        next: {
          topicId: t.id,
          title: t.title,
          subject: t.subject,
          form: t.form,
          difficulty: t.difficulty,
          mastery,
          prompt: `Eleza: ${t.title}`,
        },
        reason: p ? 'continue_path' : 'start_path',
        subject: subj,
      };
    }
  }

  // All mastered enough → weakest for review
  let weakest = null;
  let weakScore = 99;
  for (const t of catalog) {
    const p = byId[t.id];
    const mastery = p ? Number(p.mastery) : 0;
    if (mastery < weakScore) {
      weakScore = mastery;
      weakest = t;
    }
  }
  const t = weakest || catalog[0];
  const p = byId[t.id];
  return {
    next: {
      topicId: t.id,
      title: t.title,
      subject: t.subject,
      form: t.form,
      difficulty: t.difficulty,
      mastery: p ? Number(p.mastery) : 0,
      prompt: `Review: ${t.title}`,
    },
    reason: 'review',
    subject: subj,
  };
}

module.exports = { recordResult, getProgress, nextTopic };
