import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSecureOtp,
  hashString,
  generateBookingNumber,
} from '../src/common/utils/crypto.js';

describe('Crypto & Security Utilities', () => {
  it('should generate a 6-digit numeric OTP', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateSecureOtp();
      assert.strictEqual(otp.length, 6);
      assert.match(otp, /^\d{6}$/);
      const num = parseInt(otp, 10);
      assert(num >= 100000 && num <= 999999);
    }
  });

  it('should generate deterministic SHA-256 hashes', () => {
    const hash1 = hashString('123456');
    const hash2 = hashString('123456');
    const hash3 = hashString('654321');

    assert.strictEqual(hash1, hash2);
    assert.notStrictEqual(hash1, hash3);
    assert.strictEqual(hash1.length, 64);
  });

  it('should generate formatted booking numbers with date prefix', () => {
    const bookingNumber = generateBookingNumber();
    assert.match(bookingNumber, /^LM-\d{8}-[A-F0-9]{4}$/);
  });
});
