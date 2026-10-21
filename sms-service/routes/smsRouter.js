const express = require('express');
const { normalizePhoneNumber } = require('../lib/phone');
const { sendViaGateway } = require('../lib/smsGatewayClient');

const router = express.Router();

router.post('/send-sms', async (req, res) => {
  const { phoneNumber, message } = req.body || {};

  if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
    return res.status(400).json({ success: false, error: 'phoneNumber is required' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const normalizedNumber = normalizePhoneNumber(phoneNumber);

  try {
    const data = await sendViaGateway(normalizedNumber, message);
    return res.status(200).json({ success: true, data });
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
