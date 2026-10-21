const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const smsRouter = require('../routes/smsRouter');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/', smsRouter);
  return app;
}

test('SMS Router: GET /health returns service status and simulation mode', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.service, 'lifelink-sms-service');
  } finally {
    server.close();
  }
});

test('SMS Router: POST /send-sms validates missing fields', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Missing phone number
    const res1 = await fetch(`http://localhost:${port}/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' })
    });
    assert.strictEqual(res1.status, 400);

    // Missing message
    const res2 = await fetch(`http://localhost:${port}/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '9876543210' })
    });
    assert.strictEqual(res2.status, 400);
  } finally {
    server.close();
  }
});

test('SMS Router: POST /send-sms dispatches simulated SMS in dev mode', async () => {
  process.env.SMS_MOCK_MODE = 'true';
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '08888608739',
        message: 'LifeLink Test Confirmation'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.normalizedNumber, '+918888608739');
    assert.strictEqual(body.isValidMobile, true);
    assert.strictEqual(body.data?.simulated, true);
  } finally {
    server.close();
  }
});
