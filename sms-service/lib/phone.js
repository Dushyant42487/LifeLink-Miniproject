/**
 * Normalizes an Indian phone number to E.164 (+91XXXXXXXXXX).
 * - Strips spaces and dashes.
 * - If it already starts with +91, leaves it as-is.
 * - Otherwise prepends +91.
 *
 * @param {string} rawNumber
 * @returns {string}
 */
function normalizePhoneNumber(rawNumber) {
  const cleaned = String(rawNumber).replace(/[\s-]/g, '');
  return cleaned.startsWith('+91') ? cleaned : `+91${cleaned}`;
}

module.exports = { normalizePhoneNumber };
