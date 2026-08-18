'use strict';
const express = require('express');
const contentController = require('../controllers/contentController');
const { requireAuth } = require('../middleware/authMiddleware');
const { upload } = require('../services/fileStorage');

const router = express.Router();

// Auth per-route only — never router.use(requireAuth) on a router
// mounted at /api (it would block /api/admin, /api/auth, etc.)
router.post('/content', requireAuth, upload.single('file'), contentController.create);
router.get('/content', requireAuth, contentController.list);
router.get('/content/:id', requireAuth, contentController.getOne);
router.delete('/content/:id', requireAuth, contentController.remove);

module.exports = router;
