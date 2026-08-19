'use strict';
const { v4: uuidv4 } = require('uuid');
const userRepo = require('../repositories/userRepository');
const subRepo = require('../repositories/subscriptionRepository');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { AppError } = require('../utils/errors');

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function signup({ email, password, name }) {
  const normEmail = normalizeEmail(email);
  if (!validateEmail(normEmail)) throw new AppError('Invalid email', 400, 'INVALID_EMAIL');
  if (!password || String(password).length < 6) {
    throw new AppError('Password must be at least 6 characters', 400, 'WEAK_PASSWORD');
  }
  const existing = userRepo.findByEmail(normEmail);
  if (existing) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

  const now = Date.now();
  const id = uuidv4();
  const passwordHash = await hashPassword(String(password));
  const user = userRepo.create({
    id,
    email: normEmail,
    passwordHash,
    name: (name || '').trim().slice(0, 80),
    now,
  });
  subRepo.ensureFree(id);

  const token = signToken({ sub: id, email: user.email });
  return { user: userRepo.publicUser(user), token };
}

async function login({ email, password }) {
  const normEmail = normalizeEmail(email);
  if (!validateEmail(normEmail) || password == null || password === '') {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const user = userRepo.findByEmail(normEmail);
  if (!user || user.status !== 'active') {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  // Reject shadow Firebase rows that cannot log in with password
  if (user.password_hash === 'FIREBASE_SHADOW_NO_PASSWORD') {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const ok = await verifyPassword(String(password), user.password_hash);
  if (!ok) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  subRepo.ensureFree(user.id);
  const token = signToken({ sub: user.id, email: user.email });
  return { user: userRepo.publicUser(user), token };
}

function me(userId) {
  const user = userRepo.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  const sub = subRepo.ensureFree(userId);
  return {
    user: userRepo.publicUser(user),
    entitlement: {
      plan: subRepo.isProActive(sub) ? sub.plan : 'free',
      status: sub.status,
      expiresAt: sub.expires_at,
      isPro: subRepo.isProActive(sub),
    },
  };
}

module.exports = { signup, login, me, normalizeEmail };
