'use strict';
/**
 * SKONGA Learn path algorithm (stable, time-aware).
 *
 * Rules:
 * 1) Prefer topics with effective mastery < MASTERED in catalog order
 * 2) Effective mastery decays if not practiced for REVIEW_AFTER_DAYS
 * 3) Among equal path position, prefer higher wrong-rate / lower mastery
 * 4) If all mastered recently → weakest for review
 */
const progressRepo = require('../repositories/progressRepository');
const { listTopics, getTopic, CATALOG } = require('./learnCatalog');
const { AppError } = require('../utils/errors');

const MASTERED = 2; // mastery 0–3; path moves on when >= 2
const REVIEW_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days without practice → treat as needs review

function effectiveMastery(row, now = Date.now()) {
  if (!row) return 0;
  let m = Number(row.mastery) || 0;
  const updated = Number(row.updated_at) || 0;
  if (m >= MASTERED && updated > 0 && now - updated >= REVIEW_AFTER_MS) {
    // Spaced review: stale mastery counts one step lower for path decisions
    m = Math.max(0, m - 1);
  }
  return m;
}

function wrongRate(row) {
  if (!row) return 0;
  const c = Number(row.correct_count) || 0;
  const w = Number(row.wrong_count) || 0;
  const t = c + w;
  return t === 0 ? 0 : w / t;
}

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
    effectiveMastery: effectiveMastery(row),
    correctCount: Number(row.correct_count),
    wrongCount: Number(row.wrong_count),
    lastCorrect: !!Number(row.last_result),
    updatedAt: Number(row.updated_at),
  };
}

async function getProgress(userId, { subject } = {}) {
  const rows = await progressRepo.listByUser(
    userId,
    subject ? String(subject).toLowerCase() : null
  );
  const now = Date.now();
  return rows.map((r) => ({
    topicId: r.topic_id,
    subject: r.subject,
    form: r.form_level,
    mastery: Number(r.mastery),
    effectiveMastery: effectiveMastery(r, now),
    correctCount: Number(r.correct_count),
    wrongCount: Number(r.wrong_count),
    wrongRate: Math.round(wrongRate(r) * 100) / 100,
    needsReview:
      Number(r.mastery) >= MASTERED &&
      Number(r.updated_at) > 0 &&
      now - Number(r.updated_at) >= REVIEW_AFTER_MS,
    updatedAt: r.updated_at,
  }));
}

function buildNextPayload(t, p, reason, subject) {
  const now = Date.now();
  const mastery = p ? Number(p.mastery) : 0;
  const eff = effectiveMastery(p, now);
  return {
    next: {
      topicId: t.id,
      title: t.title,
      subject: t.subject,
      form: t.form,
      difficulty: t.difficulty,
      mastery,
      effectiveMastery: eff,
      prompt: reason === 'review' || reason === 'spaced_review'
        ? `Review: ${t.title}`
        : `Eleza: ${t.title}`,
    },
    reason,
    subject,
    algorithm: {
      version: 2,
      masteredThreshold: MASTERED,
      reviewAfterDays: 7,
    },
  };
}

async function nextTopic(userId, { subject, form } = {}) {
  const subj = subject ? String(subject).toLowerCase() : 'biology';
  const catalog = listTopics({ subject: subj, form });
  if (!catalog.length) {
    return {
      next: null,
      reason: 'no_topics',
      subject: subj,
      algorithm: { version: 2 },
    };
  }

  const progress = await progressRepo.listByUser(userId, subj);
  const byId = Object.fromEntries(progress.map((p) => [p.topic_id, p]));
  const now = Date.now();

  // 1) Catalog path: first topic with effective mastery < MASTERED
  for (const t of catalog) {
    const p = byId[t.id];
    const eff = effectiveMastery(p, now);
    if (eff < MASTERED) {
      const wasMastered = p && Number(p.mastery) >= MASTERED;
      const reason = !p
        ? 'start_path'
        : wasMastered
          ? 'spaced_review'
          : 'continue_path';
      return buildNextPayload(t, p, reason, subj);
    }
  }

  // 2) All path-complete recently → pick weakest (mastery then wrong-rate then oldest)
  let best = null;
  let bestScore = -1;
  for (const t of catalog) {
    const p = byId[t.id];
    const m = p ? Number(p.mastery) : 0;
    const wr = wrongRate(p);
    const age = p ? now - (Number(p.updated_at) || 0) : now;
    // Higher score = more urgent to review
    const score = (3 - m) * 10 + wr * 5 + Math.min(age / REVIEW_AFTER_MS, 3);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  const t = best || catalog[0];
  return buildNextPayload(t, byId[t.id], 'review', subj);
}

function getCatalog({ subject, form } = {}) {
  const topics = listTopics({ subject, form });
  return {
    ok: true,
    count: topics.length,
    subjects: [...new Set(CATALOG.map((t) => t.subject))],
    topics,
    algorithm: {
      version: 2,
      masteredThreshold: MASTERED,
      reviewAfterDays: 7,
      note: 'Progress + next path require JWT; catalog is public.',
    },
  };
}

module.exports = { recordResult, getProgress, nextTopic, getCatalog, effectiveMastery };
