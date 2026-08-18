'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');
require('./config/db'); // init schema

const authRoutes = require('./routes/authRoutes');
const contentRoutes = require('./routes/contentRoutes');
const usageRoutes = require('./routes/usageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { apiLimiter } = require('./middleware/rateLimitMiddleware');
const { errorMiddleware } = require('./utils/errors');
const { uploadRoot } = require('./services/fileStorage');

const app = express();

app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(apiLimiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'skonga-auth-content',
    time: new Date().toISOString(),
  });
});

app.use('/api', authRoutes);
app.use('/api', contentRoutes);
app.use('/api', usageRoutes);
app.use('/api', adminRoutes);

app.use('/files', express.static(uploadRoot));

app.use((req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));
app.use(errorMiddleware);

module.exports = app;
