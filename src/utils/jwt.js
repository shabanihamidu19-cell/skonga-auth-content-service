'use strict';
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('./errors');

function signToken(payload) {
  if (!env.jwtSecret) throw new AppError('JWT_SECRET not configured', 500, 'CONFIG');
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function verifyToken(token) {
  if (!env.jwtSecret) throw new AppError('JWT_SECRET not configured', 500, 'CONFIG');
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
  }
}

module.exports = { signToken, verifyToken };
