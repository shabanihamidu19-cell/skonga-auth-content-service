'use strict';
/**
 * analyticsService.js
 * Phase 1: product overview from existing users + usage_events only.
 * No Pro/Free breakdown. No new DB.
 */
const analyticsRepo = require('../repositories/analyticsRepository');

async function getOverview() {
  const now = Date.now();
  const dayStart = analyticsRepo.startOfUtcDay(now);
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const monthStart = now - 30 * 24 * 60 * 60 * 1000;

  const [
    totalUsers,
    newUsersToday,
    newUsers7d,
    newUsers30d,
    dau,
    wau,
    mau,
    usageAllTime,
    usageToday,
  ] = await Promise.all([
    analyticsRepo.countUsers(),
    analyticsRepo.countNewUsers(dayStart),
    analyticsRepo.countNewUsers(weekStart),
    analyticsRepo.countNewUsers(monthStart),
    analyticsRepo.countActiveUsers(dayStart),
    analyticsRepo.countActiveUsers(weekStart),
    analyticsRepo.countActiveUsers(monthStart),
    analyticsRepo.sumUnitsGrouped(null),
    analyticsRepo.sumUnitsGrouped(dayStart),
  ]);

  return {
    generatedAt: new Date(now).toISOString(),
    windows: {
      dayStart: new Date(dayStart).toISOString(),
      weekStart: new Date(weekStart).toISOString(),
      monthStart: new Date(monthStart).toISOString(),
      timezone: 'UTC',
    },
    users: {
      total: totalUsers,
      newToday: newUsersToday,
      new7d: newUsers7d,
      new30d: newUsers30d,
    },
    activeUsers: {
      dau,
      wau,
      mau,
    },
    usage: {
      allTime: {
        chat: usageAllTime.chat,
        scan: usageAllTime.scan,
        rag_query: usageAllTime.rag_query,
        file_analysis: usageAllTime.file_analysis,
        image_generation: usageAllTime.image_generation,
      },
      today: {
        chat: usageToday.chat,
        scan: usageToday.scan,
        rag_query: usageToday.rag_query,
        file_analysis: usageToday.file_analysis,
        image_generation: usageToday.image_generation,
      },
    },
    notes: [
      'DAU/WAU/MAU = distinct user_id with at least one row in usage_events in the window.',
      'Usage counters = SUM(units) from usage_events for actions: chat, scan, rag_query, file_analysis, image_generation.',
      'Numbers stay near zero if AI backend does not call POST /api/internal/usage/record (USAGE_ENABLED + userId).',
    ],
  };
}

module.exports = { getOverview };
