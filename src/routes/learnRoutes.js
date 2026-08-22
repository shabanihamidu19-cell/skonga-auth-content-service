'use strict';
const express = require('express');
const learnController = require('../controllers/learnController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/learn/result', requireAuth, learnController.postResult);
router.get('/learn/progress', requireAuth, learnController.getProgress);
router.get('/learn/next', requireAuth, learnController.getNext);

module.exports = router;
