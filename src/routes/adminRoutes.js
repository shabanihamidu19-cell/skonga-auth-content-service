'use strict';
const express = require('express');
const userRepo = require('../repositories/userRepository');
const subRepo = require('../repositories/subscriptionRepository');
const { requireServiceToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/admin/users
 * Header: X-Service-Token: <SERVICE_TOKEN>
 * Query: limit=100&offset=0
 */
router.get('/admin/users', requireServiceToken, (req, res) => {
  const limit = req.query.limit;
  const offset = req.query.offset;
  const rows = userRepo.listUsers({ limit, offset });
  const users = rows.map((row) => {
    const pub = userRepo.publicUser(row);
    const sub = subRepo.getByUserId(row.id);
    return {
      ...pub,
      plan: sub ? sub.plan : 'free',
      planExpiresAt: sub ? sub.expires_at : null,
    };
  });
  res.json({
    total: userRepo.countUsers(),
    count: users.length,
    users,
  });
});

/** GET /api/admin/stats */
router.get('/admin/stats', requireServiceToken, (req, res) => {
  res.json({
    users: userRepo.countUsers(),
    time: new Date().toISOString(),
  });
});

module.exports = router;
