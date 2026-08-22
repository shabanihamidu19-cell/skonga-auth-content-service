'use strict';
const express = require('express');
const userRepo = require('../repositories/userRepository');
const subRepo = require('../repositories/subscriptionRepository');
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

module.exports = router;
