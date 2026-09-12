'use strict';
const express = require('express');
const learnController = require('../controllers/learnController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Public — topic list for web/app (no JWT)
router.get('/learn/catalog', learnController.getCatalog);

// Authenticated — progress + adaptive path
router.post('/learn/result', requireAuth, learnController.postResult);
router.get('/learn/progress', requireAuth, learnController.getProgress);
router.get('/learn/next', requireAuth, learnController.getNext);

module.exports = router;
