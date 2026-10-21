const axios = require('axios');

/**
 * Sends a text message via the SMS Gateway for Android app (Local Server mode),
 * or simulates delivery if running in development without an active phone gateway.
 *
 * @param {string} phoneNumber - E.164 formatted number, e.g. +918888608739
 * @param {string} message - Message text
 * @returns {Promise<object>} gateway response data
 */
async function sendViaGateway(phoneNumber, message) {
  const { GATEWAY_HOST, GATEWAY_PORT, GATEWAY_USER, GATEWAY_PASS, SMS_MOCK_MODE } = process.env;

  // Development / Test Simulation Mode
  const isExplicitMock = SMS_MOCK_MODE === 'true';
  const isGatewayUnset = !GATEWAY_HOST || !GATEWAY_PORT || !GATEWAY_USER || !GATEWAY_PASS;

  if (isExplicitMock || (isGatewayUnset && process.env.NODE_ENV !== 'production')) {
    console.log(`[SMS-Gateway-Dev] Simulated SMS to ${phoneNumber}: "${message}"`);
    return {
      success: true,
      simulated: true,
      recipient: phoneNumber,
      message,
      sentAt: new Date().toISOString()
    };
  }

  if (isGatewayUnset) {
    throw new Error('Gateway configuration missing in .env (GATEWAY_HOST/PORT/USER/PASS)');
  }

  const url = `http://${GATEWAY_HOST}:${GATEWAY_PORT}/message`;

  const response = await axios.post(
    url,
    {
      textMessage: { text: message },
      phoneNumbers: [phoneNumber],
    },
    {
      auth: { username: GATEWAY_USER, password: GATEWAY_PASS },
      timeout: 10000,
    }
  );

  return response.data;
}

module.exports = { sendViaGateway };
