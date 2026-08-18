'use strict';
const authService = require('../services/authService');

async function signup(req, res, next) {
  try {
    const { email, password, name } = req.body || {};
    const result = await authService.signup({ email, password, name });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = authService.me(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, me };
