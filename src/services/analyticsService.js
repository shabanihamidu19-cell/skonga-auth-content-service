'use strict';
/**
 * Phase 1 admin analytics — real numbers from users + usage_events only.
 * No Pro/Free split. No new tables.
 */
const analyticsRepo = require('../repositories/analyticsRepository');
const db = require('../config/db');

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

module.exports = { getOverview };
