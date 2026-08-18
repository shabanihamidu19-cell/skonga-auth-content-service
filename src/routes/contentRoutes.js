'use strict';
const express = require('express');
const contentController = require('../controllers/contentController');
const { requireAuth } = require('../middleware/authMiddleware');
const { upload } = require('../services/fileStorage');

const router = express.Router();

router.use(requireAuth);

router.post('/content', upload.single('file'), contentController.create);
router.get('/content', contentController.list);
router.get('/content/:id', contentController.getOne);
router.delete('/content/:id', contentController.remove);

module.exports = router;
