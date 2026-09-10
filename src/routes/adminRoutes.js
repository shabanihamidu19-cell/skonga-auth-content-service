'use strict';
const express = require('express');
const userRepo = require('../repositories/userRepository');
const subRepo = require('../repositories/subscriptionRepository');
const analyticsService = require('../services/analyticsService');
const { requireServiceToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/admin/users', requireServiceToken, async (req, res, next) => {
  try {
    const limit = req.query.limit;
    const offset = req.query.offset;
    const rows = await userRepo.listUsers({ limit, offset });
    const users = [];
    for (const row of rows) {
      const pub = userRepo.publicUser(row);
      const sub = await subRepo.getByUserId(row.id);
      users.push({
        ...pub,
        plan: sub ? sub.plan : 'free',
        planExpiresAt: sub ? sub.expires_at : null,
      });
    }
    res.json({
      total: await userRepo.countUsers(),
      count: users.length,
      users,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/stats', requireServiceToken, async (req, res, next) => {
  try {
    res.json({
      users: await userRepo.countUsers(),
      time: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/** Phase 1 — snapshot KPIs */
router.get('/admin/analytics/overview', requireServiceToken, async (req, res, next) => {
  try {
    res.json(await analyticsService.getOverview());
  } catch (err) {
    next(err);
  }
});

/** Phase 2 — daily signups + DAU curve ?days=30 */
router.get('/admin/analytics/growth', requireServiceToken, async (req, res, next) => {
  try {
    res.json(await analyticsService.getGrowth({ days: req.query.days }));
  } catch (err) {
    next(err);
  }
});

/** Phase 2 — usage by action + daily series ?days=30&action=chat|scan|all */
router.get('/admin/analytics/usage', requireServiceToken, async (req, res, next) => {
  try {
    res.json(
      await analyticsService.getUsageSeries({
        days: req.query.days,
        action: req.query.action || 'all',
      })
    );
  } catch (err) {
    next(err);
  }
});

/** Phase 2 — D1/D7 retention by signup cohort ?cohortDays=14 */
router.get('/admin/analytics/retention', requireServiceToken, async (req, res, next) => {
  try {
    res.json(await analyticsService.getRetention({ cohortDays: req.query.cohortDays }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
