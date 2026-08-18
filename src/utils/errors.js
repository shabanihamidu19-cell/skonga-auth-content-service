'use strict';

class AppError extends Error {
  constructor(message, status = 400, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function errorMiddleware(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'ERROR';
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: err.message || 'Internal server error',
    code,
  });
}

module.exports = { AppError, errorMiddleware };
