import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  MockStorageProvider,
  S3StorageProvider,
} from '../src/modules/storage/storage-provider.js';
import {
  BookingOtpService,
  bookingOtpService,
} from '../src/modules/bookings/booking-otp.service.js';
import { env } from '../src/config/env.js';

describe('Phase 4B — S3 Storage Provider & Customer Start OTP Security Hardening', () => {
  describe('Storage Providers', () => {
    test('MockStorageProvider generates deterministic presigned upload and read URLs', async () => {
      const mockProvider = new MockStorageProvider();
      const storageKey = 'providers/prv_123/aadhaar_front.jpg';
      const result = await mockProvider.generatePresignedUploadUrl({
        storageKey,
        contentType: 'image/jpeg',
        fileSizeBytes: 1024 * 1024,
        expiresInSeconds: 900,
      });

      assert.ok(result.uploadUrl.includes('/mock-upload/'));
      assert.ok(result.uploadUrl.includes('sig='));
      assert.ok(result.uploadUrl.includes('exp='));
      assert.equal(result.storageKey, storageKey);
      assert.equal(result.expiresInSeconds, 900);
      assert.equal(result.headers['Content-Type'], 'image/jpeg');

      const readUrl = await mockProvider.generatePresignedReadUrl(storageKey);
      assert.ok(readUrl.includes(storageKey));

      mockProvider.markUploaded(storageKey);
      assert.equal(mockProvider.isUploaded(storageKey), true);

      await mockProvider.deleteFile(storageKey);
      assert.equal(mockProvider.isUploaded(storageKey), false);
    });

    test('S3StorageProvider generates standard SigV4 presigned upload and read URLs', async () => {
      const s3Provider = new S3StorageProvider('s3');
      const storageKey = 'bookings/bkg_999/before_work.png';
      const result = await s3Provider.generatePresignedUploadUrl({
        storageKey,
        contentType: 'image/png',
        fileSizeBytes: 500000,
        expiresInSeconds: 600,
      });

      assert.ok(result.uploadUrl.startsWith('https://'));
      assert.ok(result.uploadUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'));
      assert.ok(result.uploadUrl.includes('X-Amz-Credential='));
      assert.ok(result.uploadUrl.includes('X-Amz-Date='));
      assert.ok(result.uploadUrl.includes('X-Amz-Expires=600'));
      assert.ok(result.uploadUrl.includes('X-Amz-Signature='));
      assert.equal(result.headers['Content-Type'], 'image/png');

      const readUrl = await s3Provider.generatePresignedReadUrl(storageKey, 300);
      assert.ok(readUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'));
      assert.ok(readUrl.includes('X-Amz-Expires=300'));
    });

    test('S3StorageProvider supports Cloudflare R2 provider mode', async () => {
      const r2Provider = new S3StorageProvider('r2');
      assert.equal(r2Provider.providerName, 'r2');
      const result = await r2Provider.generatePresignedUploadUrl({
        storageKey: 'disputes/dsp_01/damage.jpg',
        contentType: 'image/jpeg',
        fileSizeBytes: 200000,
      });
      assert.ok(result.uploadUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'));
      assert.equal(result.storageKey, 'disputes/dsp_01/damage.jpg');
    });
  });

  describe('Customer Start OTP Security & Backward Compatibility', () => {
    beforeEach(() => {
      bookingOtpService.resetAll();
    });

    test('BookingOtpService.hashOtp uses HMAC-SHA256 with server pepper', () => {
      const plainOtp = '482910';
      const hash = BookingOtpService.hashOtp(plainOtp);
      const expectedHmac = crypto
        .createHmac('sha256', env.BOOKING_OTP_PEPPER)
        .update(plainOtp)
        .digest('hex');

      assert.equal(hash, expectedHmac);
      // Ensure it is not simply the plain unkeyed SHA-256
      const plainSha = crypto.createHash('sha256').update(plainOtp).digest('hex');
      assert.notEqual(hash, plainSha);
    });

    test('verifyStartOtp validates correctly against HMAC-SHA256 hash', () => {
      const plainOtp = '654321';
      const startOtpHash = BookingOtpService.hashOtp(plainOtp);

      assert.doesNotThrow(() => {
        bookingOtpService.verifyStartOtp(
          {
            id: 'bkg_otp_test_1',
            startOtpHash,
            createdAt: new Date(),
          },
          '654321'
        );
      });
    });

    test('verifyStartOtp provides backward compatibility for legacy unkeyed SHA-256 hashes', () => {
      const plainOtp = '123456';
      const legacySha256 = crypto.createHash('sha256').update(plainOtp).digest('hex');

      assert.doesNotThrow(() => {
        bookingOtpService.verifyStartOtp(
          {
            id: 'bkg_otp_legacy_sha',
            startOtpHash: legacySha256,
            createdAt: new Date(),
          },
          '123456'
        );
      });
    });

    test('verifyStartOtp provides backward compatibility for legacy plaintext records', () => {
      const plainOtp = '789012';

      assert.doesNotThrow(() => {
        bookingOtpService.verifyStartOtp(
          {
            id: 'bkg_otp_legacy_plain',
            startOtp: plainOtp,
            createdAt: new Date(),
          },
          '789012'
        );
      });
    });

    test('verifyStartOtp locks out after 5 consecutive failed attempts', () => {
      const bookingId = 'bkg_otp_lockout_test';
      const startOtpHash = BookingOtpService.hashOtp('999888');

      for (let i = 1; i <= 4; i++) {
        assert.throws(
          () => {
            bookingOtpService.verifyStartOtp(
              { id: bookingId, startOtpHash, createdAt: new Date() },
              '000000'
            );
          },
          (err: any) => err.statusCode === 422 && err.message.includes('attempt')
        );
      }

      // 5th attempt triggers lockout
      assert.throws(
        () => {
          bookingOtpService.verifyStartOtp(
            { id: bookingId, startOtpHash, createdAt: new Date() },
            '000000'
          );
        },
        (err: any) => err.statusCode === 429 && err.message.includes('locked')
      );

      // Subsequent attempt even with correct OTP is locked
      assert.throws(
        () => {
          bookingOtpService.verifyStartOtp(
            { id: bookingId, startOtpHash, createdAt: new Date() },
            '999888'
          );
        },
        (err: any) => err.statusCode === 429 && err.message.includes('locked')
      );
    });
  });

  describe('Financial Refund Protection & Liability Accounting', () => {
    test('processRefundAdjustment fully recovers when wallet has sufficient balance', async () => {
      const { financialService } = await import('../src/modules/financial/financial.service.js');

      let updatedWalletData: any = null;
      let createdLedgerData: any = null;

      const mockDb: any = {
        booking: {
          findUnique: async () => ({
            id: 'bkg_ref_01',
            bookingNumber: 'BKG-REF-01',
            customerId: 'cust_01',
            providerId: 'prv_01',
            totalAmountPaisa: 100000,
          }),
        },
        walletLedgerEntry: {
          findFirst: async () => ({
            id: 'led_credit_01',
            amountPaisa: 84000,
            direction: 'CREDIT',
            entryType: 'PROVIDER_NET_EARNING',
          }),
          create: async ({ data }: any) => {
            createdLedgerData = data;
            return { id: 'led_refund_01', ...data };
          },
        },
        providerWallet: {
          findUnique: async () => ({
            id: 'wal_01',
            providerId: 'prv_01',
            availableBalancePaisa: 100000,
            pendingBalancePaisa: 0,
          }),
          update: async ({ data }: any) => {
            updatedWalletData = data;
            return {
              id: 'wal_01',
              providerId: 'prv_01',
              availableBalancePaisa: 100000 - data.availableBalancePaisa.decrement,
              pendingBalancePaisa: 0,
            };
          },
        },
        providerPayout: {
          findFirst: async () => null,
        },
      };

      const result = await financialService.processRefundAdjustment(
        'bkg_ref_01',
        100000,
        'Customer cancellation',
        'adm_01',
        mockDb
      );

      assert.ok(result);
      assert.equal(result.debitPaisa, 84000);
      assert.equal(result.actualRecoveredPaisa, 84000);
      assert.equal(result.unrecoveredLiabilityPaisa, 0);
      assert.equal(updatedWalletData.availableBalancePaisa.decrement, 84000);
      assert.equal(createdLedgerData.amountPaisa, 84000);
      assert.equal(createdLedgerData.metadata.isFullyRecovered, true);
      assert.equal(createdLedgerData.metadata.unrecoveredLiabilityPaisa, 0);
    });

    test('processRefundAdjustment handles underfunded wallet without balance underflow', async () => {
      const { financialService } = await import('../src/modules/financial/financial.service.js');

      let updatedWalletData: any = null;
      let createdLedgerData: any = null;

      // Provider only has 30,000 paisa available, but debit is 84,000 paisa
      const mockDb: any = {
        booking: {
          findUnique: async () => ({
            id: 'bkg_ref_02',
            bookingNumber: 'BKG-REF-02',
            customerId: 'cust_02',
            providerId: 'prv_02',
            totalAmountPaisa: 100000,
          }),
        },
        walletLedgerEntry: {
          findFirst: async () => ({
            id: 'led_credit_02',
            amountPaisa: 84000,
            direction: 'CREDIT',
            entryType: 'PROVIDER_NET_EARNING',
          }),
          create: async ({ data }: any) => {
            createdLedgerData = data;
            return { id: 'led_refund_02', ...data };
          },
        },
        providerWallet: {
          findUnique: async () => ({
            id: 'wal_02',
            providerId: 'prv_02',
            availableBalancePaisa: 30000,
            pendingBalancePaisa: 0,
          }),
          update: async ({ data }: any) => {
            updatedWalletData = data;
            return {
              id: 'wal_02',
              providerId: 'prv_02',
              availableBalancePaisa: 30000 - data.availableBalancePaisa.decrement,
              pendingBalancePaisa: 0,
            };
          },
        },
        providerPayout: {
          findFirst: async () => null,
        },
      };

      const result = await financialService.processRefundAdjustment(
        'bkg_ref_02',
        100000,
        'Defective service refund',
        'adm_02',
        mockDb
      );

      assert.ok(result);
      assert.equal(result.debitPaisa, 84000);
      // Actual recovered amount is capped at available balance
      assert.equal(result.actualRecoveredPaisa, 30000);
      // Unrecovered liability recorded explicitly
      assert.equal(result.unrecoveredLiabilityPaisa, 54000);
      assert.equal(updatedWalletData.availableBalancePaisa.decrement, 30000);
      assert.equal(createdLedgerData.amountPaisa, 30000);
      assert.equal(createdLedgerData.metadata.isFullyRecovered, false);
      assert.equal(createdLedgerData.metadata.unrecoveredLiabilityPaisa, 54000);
      assert.equal(createdLedgerData.metadata.requestedDebitPaisa, 84000);
    });
  });
});
