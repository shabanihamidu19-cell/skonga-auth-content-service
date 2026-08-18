'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Isolated test DB + secrets (before requiring app)
process.env.JWT_SECRET = 'test_jwt_secret_key_32chars_min!!';
process.env.SERVICE_TOKEN = 'test_service_token_for_admin_and_usage';
process.env.DATABASE_PATH = path.join(__dirname, '..', 'data', 'test-auth.sqlite');
process.env.PORT = '0';
process.env.NODE_ENV = 'test';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
for (const f of ['test-auth.sqlite', 'test-auth.json']) {
  try {
    fs.unlinkSync(path.join(dataDir, f));
  } catch (_) {}
}

const app = require('../src/app');

function listen(appInstance) {
  return new Promise((resolve) => {
    const server = http.createServer(appInstance);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function json(base, method, urlPath, body, headers = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  const res = await fetch(base + urlPath, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('skonga-auth-content-service', () => {
  let base;
  let server;
  let token;
  let userId;
  const email = `u${Date.now()}@test.local`;

  before(async () => {
    ({ server, base } = await listen(app));
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
  });

  it('GET /health', async () => {
    const r = await json(base, 'GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.status, 'ok');
  });

  it('POST /api/auth/signup', async () => {
    const r = await json(base, 'POST', '/api/auth/signup', {
      email,
      password: 'secret12',
      name: 'Tester',
    });
    assert.equal(r.status, 201);
    assert.ok(r.data.token);
    assert.ok(r.data.user?.id);
    token = r.data.token;
    userId = r.data.user.id;
  });

  it('POST /api/auth/login', async () => {
    const r = await json(base, 'POST', '/api/auth/login', {
      email,
      password: 'secret12',
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.token);
  });

  it('GET /api/auth/me', async () => {
    const r = await json(base, 'GET', '/api/auth/me', null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.user?.email || r.data.email, email);
  });

  it('GET /api/usage/check', async () => {
    const r = await json(base, 'GET', '/api/usage/check?action=chat', null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.allowed, true);
  });

  it('GET /api/internal/usage/check with service token', async () => {
    const r = await json(
      base,
      'GET',
      `/api/internal/usage/check?userId=${userId}&action=chat`,
      null,
      { 'X-Service-Token': process.env.SERVICE_TOKEN }
    );
    assert.equal(r.status, 200);
    assert.equal(r.data.allowed, true);
  });

  it('GET /api/admin/users with service token', async () => {
    const r = await json(base, 'GET', '/api/admin/users', null, {
      'X-Service-Token': process.env.SERVICE_Token || process.env.SERVICE_TOKEN,
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.total >= 1);
    assert.ok(Array.isArray(r.data.users));
  });

  it('rejects admin without token', async () => {
    const r = await json(base, 'GET', '/api/admin/users');
    assert.ok(r.status === 401 || r.status === 503);
  });
});
