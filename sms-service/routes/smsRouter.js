const express = require('express');
const { normalizePhoneNumber, isValidIndianMobile } = require('../lib/phone');
const { sendViaGateway } = require('../lib/smsGatewayClient');

const router = express.Router();

// Health & Status Probe
router.get('/health', (req, res) => {
  const { GATEWAY_HOST, GATEWAY_PORT, SMS_MOCK_MODE } = process.env;
  const isConfigured = Boolean(GATEWAY_HOST && GATEWAY_PORT);
  res.status(200).json({
    status: 'ok',
    service: 'lifelink-sms-service',
    mode: SMS_MOCK_MODE === 'true' || !isConfigured ? 'simulation' : 'gateway_bridged',
    gatewayConfigured: isConfigured,
    timestamp: new Date().toISOString()
  });
});

// Primary SMS Dispatch Endpoint
router.post('/send-sms', async (req, res) => {
  const { phoneNumber, message } = req.body || {};

  if (!phoneNumber || (typeof phoneNumber !== 'string' && typeof phoneNumber !== 'number') || !String(phoneNumber).trim()) {
    return res.status(400).json({ success: false, error: 'phoneNumber is required' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  let normalizedNumber;
  try {
    normalizedNumber = normalizePhoneNumber(phoneNumber);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  try {
    const data = await sendViaGateway(normalizedNumber, message.trim());
    return res.status(200).json({
      success: true,
      normalizedNumber,
      isValidMobile: isValidIndianMobile(normalizedNumber),
      data
    });
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data || err.message;

    return res.status(502).json({
      success: false,
      error: 'Failed to send SMS via gateway',
      detail,
      gatewayStatus: status,
    });
  }
});

module.exports = router;
