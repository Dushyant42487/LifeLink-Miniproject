const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhoneNumber, isValidIndianMobile, formatDisplayPhoneNumber } = require('../lib/phone');

test('Phone Normalization: correctly normalizes standard 10-digit number', () => {
  assert.strictEqual(normalizePhoneNumber('8888608739'), '+918888608739');
  assert.strictEqual(normalizePhoneNumber(8888608739), '+918888608739');
});

test('Phone Normalization: handles existing +91 prefix and formatting', () => {
  assert.strictEqual(normalizePhoneNumber('+918888608739'), '+918888608739');
  assert.strictEqual(normalizePhoneNumber('+91 88886 08739'), '+918888608739');
  assert.strictEqual(normalizePhoneNumber('+91-88886-08739'), '+918888608739');
  assert.strictEqual(normalizePhoneNumber('+91 (88886) 08739'), '+918888608739');
});

test('Phone Normalization: handles 91 prefix without plus', () => {
  assert.strictEqual(normalizePhoneNumber('918888608739'), '+918888608739');
});

test('Phone Normalization: handles leading trunk 0', () => {
  assert.strictEqual(normalizePhoneNumber('08888608739'), '+918888608739');
  assert.strictEqual(normalizePhoneNumber('0 88886 08739'), '+918888608739');
});

test('Phone Normalization: handles international 0091 prefix', () => {
  assert.strictEqual(normalizePhoneNumber('00918888608739'), '+918888608739');
});

test('Phone Normalization: rejects null, undefined, or empty', () => {
  assert.throws(() => normalizePhoneNumber(null), /cannot be null/);
  assert.throws(() => normalizePhoneNumber(undefined), /cannot be null/);
  assert.throws(() => normalizePhoneNumber(''), /cannot be empty/);
});

test('Phone Validation: checks Indian mobile standard (6-9 start, 10 digits)', () => {
  assert.strictEqual(isValidIndianMobile('9876543210'), true);
  assert.strictEqual(isValidIndianMobile('8888608739'), true);
  assert.strictEqual(isValidIndianMobile('7012345678'), true);
  assert.strictEqual(isValidIndianMobile('6123456789'), true);
  assert.strictEqual(isValidIndianMobile('08888608739'), true);
  assert.strictEqual(isValidIndianMobile('+91 88886 08739'), true);

  // Invalid cases
  assert.strictEqual(isValidIndianMobile('1234567890'), false);
  assert.strictEqual(isValidIndianMobile('5555555555'), false);
  assert.strictEqual(isValidIndianMobile('88886'), false);
});

test('Display Formatting: formats cleanly as +91 XXXXX XXXXX', () => {
  assert.strictEqual(formatDisplayPhoneNumber('8888608739'), '+91 88886 08739');
  assert.strictEqual(formatDisplayPhoneNumber('+918888608739'), '+91 88886 08739');
});
