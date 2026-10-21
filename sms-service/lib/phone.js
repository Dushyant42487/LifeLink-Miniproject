/**
 * LifeLink Phone Normalization & Validation Utility
 *
 * Normalizes Indian phone numbers to E.164 format (+91XXXXXXXXXX).
 * - Strips non-numeric characters (spaces, dashes, parentheses, dots).
 * - Corrects various common dialing prefixes:
 *   - Local 10-digit: "8888608739" -> "+918888608739"
 *   - With trunk prefix: "08888608739" -> "+918888608739"
 *   - With country code: "918888608739" -> "+918888608739"
 *   - With intl prefix: "00918888608739" -> "+918888608739"
 *   - Existing E.164: "+918888608739" -> "+918888608739"
 *
 * @param {string|number} rawNumber
 * @returns {string} E.164 formatted phone number
 */
function normalizePhoneNumber(rawNumber) {
  if (rawNumber === null || rawNumber === undefined) {
    throw new Error('Phone number cannot be null or undefined');
  }

  const str = String(rawNumber).trim();
  if (!str) {
    throw new Error('Phone number cannot be empty');
  }

  // Strip all non-digit and non-plus characters
  let cleaned = str.replace(/[^\d+]/g, '');

  // Strip international prefix '0091'
  if (cleaned.startsWith('0091')) {
    cleaned = '+91' + cleaned.slice(4);
  }

  // If already starts with '+91', retain the 10 digits that follow
  if (cleaned.startsWith('+91')) {
    const digits = cleaned.slice(3).replace(/\D/g, '');
    return '+91' + digits;
  }

  // If starts with another international country code (e.g. +1, +44)
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  const digitsOnly = cleaned.replace(/\D/g, '');

  // 12 digits starting with country code 91
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return '+91' + digitsOnly.slice(2);
  }

  // 11 digits starting with trunk 0
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return '+91' + digitsOnly.slice(1);
  }

  // Standard 10-digit Indian number
  return '+91' + digitsOnly;
}

/**
 * Validates if a phone number matches TRAI Indian mobile standards (10 digits starting with 6-9).
 *
 * @param {string|number} rawNumber
 * @returns {boolean}
 */
function isValidIndianMobile(rawNumber) {
  try {
    const normalized = normalizePhoneNumber(rawNumber);
    return /^\+91[6-9]\d{9}$/.test(normalized);
  } catch {
    return false;
  }
}

/**
 * Formats an E.164 phone number into human-readable display (+91 XXXXX XXXXX).
 *
 * @param {string|number} rawNumber
 * @returns {string}
 */
function formatDisplayPhoneNumber(rawNumber) {
  try {
    const normalized = normalizePhoneNumber(rawNumber);
    if (normalized.startsWith('+91') && normalized.length === 13) {
      return `+91 ${normalized.slice(3, 8)} ${normalized.slice(8)}`;
    }
    return normalized;
  } catch {
    return String(rawNumber || '');
  }
}

module.exports = {
  normalizePhoneNumber,
  isValidIndianMobile,
  formatDisplayPhoneNumber
};
