'use strict';
/**
 * Admin analytics — users + usage_events only.
 * Phase 1: overview
 * Phase 2: growth, usage time-series, retention
 */
const analyticsRepo = require('../repositories/analyticsRepository');
const db = require('../config/db');

function clampDays(raw, fallback = 30, max = 90) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

async function getOverview() {
  const now = Date.now();
  const todayStart = analyticsRepo.startOfUtcDay(now);
  const weekStart = analyticsRepo.daysAgoMs(7);
  const monthStart = analyticsRepo.daysAgoMs(30);

  const [
    totalUsers,
    newUsersToday,
    newUsers7d,
    newUsers30d,
    dau,
    wau,
    mau,
    usage,
  ] = await Promise.all([
    analyticsRepo.countUsers(),
    analyticsRepo.countUsersCreatedSince(todayStart),
    analyticsRepo.countUsersCreatedSince(weekStart),
    analyticsRepo.countUsersCreatedSince(monthStart),
    analyticsRepo.countActiveUsersSince(todayStart),
    analyticsRepo.countActiveUsersSince(weekStart),
    analyticsRepo.countActiveUsersSince(monthStart),
    analyticsRepo.usageByAction(),
  ]);

  return {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    timezone: 'UTC',
    db: db.driver,
    durable: db.driver === 'postgres',
    users: {
      total: totalUsers,
      newToday: newUsersToday,
      newLast7d: newUsers7d,
      newLast30d: newUsers30d,
    },
    activity: {
      dau,
      wau,
      mau,
      note:
        'DAU/WAU/MAU = distinct user_id with at least one usage_events row in the window',
    },
    usage: {
      chat: usage.chat,
      scan: usage.scan,
      rag_query: usage.rag_query,
      file_analysis: usage.file_analysis,
      image_generation: usage.image_generation,
      note:
        'total = all-time SUM(units); today = UTC calendar day; usersToday = distinct users for that action today',
    },
  };
}

/** New users + DAU curve */
async function getGrowth({ days = 30 } = {}) {
  const d = clampDays(days, 30, 90);
  const [signups, active] = await Promise.all([
    analyticsRepo.newUsersByDay(d),
    analyticsRepo.activeUsersByDay(d),
  ]);
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    timezone: 'UTC',
    days: d,
    signups: signups.map((x) => ({ date: x.date, newUsers: x.value })),
    activeUsers: active.map((x) => ({ date: x.date, dau: x.value })),
  };
}

/** Usage totals in window + daily series */
async function getUsageSeries({ days = 30, action = 'all' } = {}) {
  const d = clampDays(days, 30, 90);
  const since = analyticsRepo.startOfUtcDay(analyticsRepo.daysAgoMs(d - 1));
  const act = action && String(action).trim() ? String(action).trim() : 'all';

  const [byAction, series] = await Promise.all([
    analyticsRepo.usageByActionSince(since),
    analyticsRepo.usageUnitsByDay(d, act === 'all' ? null : act),
  ]);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    timezone: 'UTC',
    days: d,
    action: act,
    byAction,
    series: series.map((x) => ({ date: x.date, units: x.value })),
  };
}

/** Signup cohort D1 / D7 retention */
async function getRetention({ cohortDays = 14 } = {}) {
  const n = clampDays(cohortDays, 14, 30);
  const cohorts = await analyticsRepo.retentionCohorts(n);
  const matureD1 = cohorts.filter((c) => c.d1Mature && c.size > 0);
  const matureD7 = cohorts.filter((c) => c.d7Mature && c.size > 0);
  const avg = (arr, key) =>
    arr.length
      ? Number(
          (
            arr.reduce((s, c) => s + (c[key] || 0), 0) / arr.length
          ).toFixed(1)
        )
      : null;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    timezone: 'UTC',
    cohortDays: n,
    summary: {
      avgD1Rate: avg(matureD1, 'd1Rate'),
      avgD7Rate: avg(matureD7, 'd7Rate'),
      matureCohortsD1: matureD1.length,
      matureCohortsD7: matureD7.length,
    },
    cohorts,
    note:
      'D1/D7 = user had any usage_events on calendar day +1 / +7 after signup (UTC). Rate is null until cohort is mature.',
  };
}

module.exports = { getOverview, getGrowth, getUsageSeries, getRetention };
