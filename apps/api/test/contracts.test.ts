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

describe('FinancialService: Canonical Fee & Pricing Derivations', () => {
  it('should calculate canonical 15% platform commission fee accurately in integer paisa', async () => {
    const { FinancialService } = await import('../src/modules/financial/financial.service.js');

    // ₹1000 base (100,000 paisa) -> 15% = 15,000 paisa (₹150)
    const feeDefault = FinancialService.calculatePlatformFee(100000);
    assert.strictEqual(feeDefault, 15000);

    // Custom commission rate override (e.g., 20%)
    const feeCustom = FinancialService.calculatePlatformFee(100000, 20.0);
    assert.strictEqual(feeCustom, 20000);

    // Rounding check: ₹499 base (49,900 paisa) * 15% = 7485 paisa
    const feeRounding = FinancialService.calculatePlatformFee(49900);
    assert.strictEqual(feeRounding, 7485);

    // Clamp negative amounts to 0
    const feeNegative = FinancialService.calculatePlatformFee(-5000);
    assert.strictEqual(feeNegative, 0);
  });

  it('should derive authoritative booking pricing breakdown with 18% GST', async () => {
    const { FinancialService } = await import('../src/modules/financial/financial.service.js');

    // Fixed price booking of ₹1000 (100,000 paisa)
    const pricing = FinancialService.deriveBookingPricing({
      baseAmountPaisa: 100000,
    });

    assert.strictEqual(pricing.baseAmountPaisa, 100000);
    assert.strictEqual(pricing.platformFeePaisa, 15000); // 15% platform fee
    assert.strictEqual(pricing.taxAmountPaisa, 18000);   // 18% GST
    assert.strictEqual(pricing.totalAmountPaisa, 118000); // Base + Tax
    assert.strictEqual(pricing.providerEarningPaisa, 85000); // Base - Fee
    assert.strictEqual(pricing.platformCommissionPercent, 15.0);
    assert.strictEqual(pricing.gstRatePercent, 18.0);
  });

  it('should derive zeroed amounts for CUSTOM_QUOTE with 0 base amount', async () => {
    const { FinancialService } = await import('../src/modules/financial/financial.service.js');

    const pricing = FinancialService.deriveBookingPricing({
      baseAmountPaisa: 0,
    });

    assert.strictEqual(pricing.baseAmountPaisa, 0);
    assert.strictEqual(pricing.platformFeePaisa, 0);
    assert.strictEqual(pricing.taxAmountPaisa, 0);
    assert.strictEqual(pricing.totalAmountPaisa, 0);
    assert.strictEqual(pricing.providerEarningPaisa, 0);
  });
});
