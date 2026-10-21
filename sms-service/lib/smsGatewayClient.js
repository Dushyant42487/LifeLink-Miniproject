const axios = require('axios');

/**
 * Sends a text message via the SMS Gateway for Android app (Local Server mode).
 *
 * @param {string} phoneNumber - E.164 formatted number, e.g. +918888608739
 * @param {string} message
 * @returns {Promise<object>} gateway response data
 */
async function sendViaGateway(phoneNumber, message) {
  const { GATEWAY_HOST, GATEWAY_PORT, GATEWAY_USER, GATEWAY_PASS } = process.env;

  if (!GATEWAY_HOST || !GATEWAY_PORT || !GATEWAY_USER || !GATEWAY_PASS) {
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
