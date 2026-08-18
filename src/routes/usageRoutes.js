'use strict';
const express = require('express');
const usageController = require('../controllers/usageController');
const { requireAuth, requireServiceToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/usage', requireAuth, usageController.getSnapshot);
router.get('/usage/check', requireAuth, usageController.check);

// Server-to-server (AI backend)
router.post('/internal/usage/record', requireServiceToken, usageController.internalRecord);
router.get('/internal/usage/check', requireServiceToken, usageController.internalCheck);

module.exports = router;
