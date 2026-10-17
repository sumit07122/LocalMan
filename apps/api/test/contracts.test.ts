import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SendOtpSchema,
  VerifyOtpSchema,
  UpdateProviderProfileSchema,
} from '@localman/contracts';

describe('Contracts & Indian Market Validation Rules', () => {
  it('should accept valid 10-digit Indian mobile numbers', () => {
    const valid = SendOtpSchema.safeParse({
      phoneNumber: '9876543210',
    });
    assert.strictEqual(valid.success, true);
    if (valid.success) {
      assert.strictEqual(valid.data.phoneCountryCode, '+91');
    }
  });

  it('should reject invalid mobile numbers not matching Indian mobile prefixes', () => {
    // Starts with 1
    const invalid1 = SendOtpSchema.safeParse({ phoneNumber: '1234567890' });
    assert.strictEqual(invalid1.success, false);

    // 9 digits
    const invalid2 = SendOtpSchema.safeParse({ phoneNumber: '987654321' });
    assert.strictEqual(invalid2.success, false);

    // Contains letters
    const invalid3 = SendOtpSchema.safeParse({ phoneNumber: '987654321a' });
    assert.strictEqual(invalid3.success, false);
  });

  it('should validate 6-digit OTP format in VerifyOtpSchema', () => {
    const valid = VerifyOtpSchema.safeParse({
      phoneNumber: '9876543210',
      otp: '654321',
    });
    assert.strictEqual(valid.success, true);

    const invalid = VerifyOtpSchema.safeParse({
      phoneNumber: '9876543210',
      otp: '123', // too short
    });
    assert.strictEqual(invalid.success, false);
  });

  it('should validate Indian IFSC code and UPI ID formats', () => {
    const validProfile = UpdateProviderProfileSchema.safeParse({
      businessName: 'Sharma Plumbing Services',
      experienceYears: 7,
      bankIfscCode: 'HDFC0001234',
      upiId: 'sharma@okhdfcbank',
    });
    assert.strictEqual(validProfile.success, true);

    const invalidIfsc = UpdateProviderProfileSchema.safeParse({
      bankIfscCode: 'INVALID123',
    });
    assert.strictEqual(invalidIfsc.success, false);

    const invalidUpi = UpdateProviderProfileSchema.safeParse({
      upiId: 'invalid-upi-without-at-domain',
    });
    assert.strictEqual(invalidUpi.success, false);
  });
});
