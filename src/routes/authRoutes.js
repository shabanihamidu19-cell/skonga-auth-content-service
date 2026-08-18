'use strict';
const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post('/auth/signup', authLimiter, authController.signup);
router.post('/auth/login', authLimiter, authController.login);
router.get('/auth/me', requireAuth, authController.me);

module.exports = router;
