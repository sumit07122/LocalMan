import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import {
  MockSmsGateway,
  Fast2SmsGateway,
  Msg91Gateway,
  TwilioGateway,
  setSmsGatewayForTest,
} from '../src/modules/auth/sms-gateway.interface.js';
import { RazorpayAdapter } from '../src/modules/payments/adapters/razorpay.adapter.js';
import {
  MockStorageProvider,
  S3StorageProvider,
  setStorageProviderForTest,
} from '../src/modules/storage/storage-provider.js';
import {
  DeviceTokenRegistry,
  FcmNotificationProvider,
  DevNotificationAdapter,
} from '../src/modules/notifications/notification.service.js';
import { GoogleMapsService } from '../src/modules/location/google-maps.service.js';

describe('Phase 4J: External Service Integrations Architecture & Verification', () => {

  // =========================================================================
  // 1. SMS / OTP GATEWAYS
  // =========================================================================
  describe('1. SMS & OTP Gateway Suite', () => {
    it('1.1 MockSmsGateway records message and safely logs OTP without throwing', async () => {
      const mockGateway = new MockSmsGateway();
      const result = await mockGateway.sendOtp({
        toPhoneNumber: '+919876543210',
        message: 'Your LocalMan code is 482910',
        otpCode: '482910',
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.messageId?.startsWith('mock_sms_'));
      assert.strictEqual(mockGateway.lastDispatchedMessage?.otp, '482910');
      assert.strictEqual(mockGateway.lastDispatchedMessage?.to, '+919876543210');
    });

    it('1.2 Fast2SmsGateway rejects unconfigured API key gracefully', async () => {
      const gateway = new Fast2SmsGateway('mock_key');
      const result = await gateway.sendOtp({
        toPhoneNumber: '+919876543210',
        message: 'Your LocalMan code is 123456',
        otpCode: '123456',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'FAST2SMS_API_KEY_UNCONFIGURED');
    });

    it('1.3 Fast2SmsGateway dispatches DLT OTP payload when configured', async () => {
      let capturedUrl = '';
      let capturedHeaders: any = {};
      let capturedBody: any = {};

      const mockFetch = async (url: string, opts: any) => {
        capturedUrl = url;
        capturedHeaders = opts.headers;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ return: true, request_id: 'f2s_req_998877', message: ['SMS sent'] }),
        } as any;
      };

      const gateway = new Fast2SmsGateway('real_api_key_xyz', 'LCLMAN', mockFetch as any);
      const result = await gateway.sendOtp({
        toPhoneNumber: '+919876543210',
        message: 'Your code is 654321',
        otpCode: '654321',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.messageId, 'f2s_req_998877');
      assert.strictEqual(capturedUrl, 'https://www.fast2sms.com/dev/bulkV2');
      assert.strictEqual(capturedHeaders.authorization, 'real_api_key_xyz');
      assert.strictEqual(capturedBody.route, 'otp');
      assert.strictEqual(capturedBody.variables_values, '654321');
      assert.strictEqual(capturedBody.numbers, '9876543210');
    });

    it('1.4 Msg91Gateway rejects unconfigured authkey', async () => {
      const gateway = new Msg91Gateway('mock_key');
      const result = await gateway.sendOtp({
        toPhoneNumber: '+919876543210',
        message: 'Your code is 123456',
        otpCode: '123456',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'MSG91_AUTHKEY_UNCONFIGURED');
    });

    it('1.5 Msg91Gateway dispatches OTP request via enterprise API', async () => {
      let capturedUrl = '';
      const mockFetch = async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ type: 'success', request_id: 'msg91_req_554433', message: 'OTP sent successfully' }),
        } as any;
      };

      const gateway = new Msg91Gateway('valid_authkey_123', 'tmpl_9999', mockFetch as any);
      const result = await gateway.sendOtp({
        toPhoneNumber: '+919876543210',
        message: 'Your OTP is 789012',
        otpCode: '789012',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.messageId, 'msg91_req_554433');
      assert.ok(capturedUrl.includes('control.msg91.com/api/v5/otp'));
      assert.ok(capturedUrl.includes('authkey=valid_authkey_123'));
      assert.ok(capturedUrl.includes('template_id=tmpl_9999'));
      assert.ok(capturedUrl.includes('otp=789012'));
    });

    it('1.6 TwilioGateway rejects unconfigured credentials', async () => {
      const gateway = new TwilioGateway('', '', '');
      const result = await gateway.sendOtp({
        toPhoneNumber: '+919876543210',
        message: 'Your code is 123456',
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'TWILIO_CREDENTIALS_UNCONFIGURED');
    });

    it('1.7 TwilioGateway formats basic auth and form body correctly', async () => {
      let capturedAuth = '';
      let capturedBody = '';

      const mockFetch = async (_url: string, opts: any) => {
        capturedAuth = opts.headers.Authorization;
        capturedBody = opts.body;
        return {
          ok: true,
          status: 201,
          json: async () => ({ sid: 'SM_twilio_sid_12345' }),
        } as any;
      };

      const gateway = new TwilioGateway('AC_test_account', 'test_auth_token', '+15550001111', mockFetch as any);
      const result = await gateway.sendOtp({
        toPhoneNumber: '+919876543210',
        message: 'Your LocalMan code is 112233',
        otpCode: '112233',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.messageId, 'SM_twilio_sid_12345');
      const expectedBasic = Buffer.from('AC_test_account:test_auth_token').toString('base64');
      assert.strictEqual(capturedAuth, `Basic ${expectedBasic}`);
      assert.ok(capturedBody.includes('To=%2B919876543210'));
      assert.ok(capturedBody.includes('From=%2B15550001111'));
    });
  });

  // =========================================================================
  // 2. RAZORPAY PAYMENTS & WEBHOOKS
  // =========================================================================
  describe('2. Razorpay Payments & Webhooks', () => {
    const keySecret = 'test_razorpay_secret_key_12345';
    const webhookSecret = 'test_webhook_secret_key_67890';
    const adapter = new RazorpayAdapter({
      keyId: 'rzp_test_valid_key',
      keySecret,
      webhookSecret,
    });

    it('2.1 Verifies valid payment signature using timingSafeEqual', () => {
      const orderId = 'order_DAE123456789';
      const paymentId = 'pay_HJK987654321';
      const expectedText = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac('sha256', keySecret)
        .update(expectedText)
        .digest('hex');

      const isValid = adapter.verifyPaymentSignature({
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: validSignature,
      });

      assert.strictEqual(isValid, true);
    });

    it('2.2 Rejects tampered payment signature', () => {
      const orderId = 'order_DAE123456789';
      const paymentId = 'pay_HJK987654321';
      const forgedSignature = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = adapter.verifyPaymentSignature({
        gatewayOrderId: orderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: forgedSignature,
      });

      assert.strictEqual(isValid, false);
    });

    it('2.3 Rejects signature when length differs without leaking timing', () => {
      const isValid = adapter.verifyPaymentSignature({
        gatewayOrderId: 'order_1',
        gatewayPaymentId: 'pay_1',
        gatewaySignature: 'short_sig',
      });

      assert.strictEqual(isValid, false);
    });

    it('2.4 Verifies genuine Razorpay webhook signature over raw payload', () => {
      const rawPayload = JSON.stringify({
        entity: 'event',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_ABC123',
              amount: 149900,
              status: 'captured',
            },
          },
        },
      });

      const validWebhookSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');

      const isVerified = adapter.verifyWebhookSignature(rawPayload, validWebhookSig);
      assert.strictEqual(isVerified, true);
    });

    it('2.5 Rejects tampered or unauthenticated webhook payload', () => {
      const rawPayload = JSON.stringify({ event: 'payment.captured' });
      const isVerified = adapter.verifyWebhookSignature(rawPayload, 'invalid_signature_xyz');
      assert.strictEqual(isVerified, false);
    });

    it('2.6 Executes server-side refund with Basic Auth & integer paisa', async () => {
      let capturedUrl = '';
      let capturedAuth = '';
      let capturedBody: any = {};

      const mockFetch = async (url: string, opts: any) => {
        capturedUrl = url;
        capturedAuth = opts.headers.Authorization;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'rfnd_LIVE_776655', amount: capturedBody.amount, status: 'processed' }),
        } as any;
      };

      const customAdapter = new RazorpayAdapter({
        keyId: 'rzp_test_active_key',
        keySecret: 'rzp_test_secret_123',
        fetchFn: mockFetch as any,
      });

      const refundResult = await customAdapter.processRefund({
        gatewayPaymentId: 'pay_TARGET_999',
        amountPaisa: 50000, // ₹500.00 in integer paisa
        reason: 'Customer requested cancellation prior to provider arrival',
      });

      assert.strictEqual(refundResult.gatewayRefundId, 'rfnd_LIVE_776655');
      assert.ok(capturedUrl.includes('/v1/payments/pay_TARGET_999/refund'));
      assert.strictEqual(capturedBody.amount, 50000);
      assert.strictEqual(capturedBody.notes.reason, 'Customer requested cancellation prior to provider arrival');
      assert.ok(capturedAuth.startsWith('Basic '));
    });
  });

  // =========================================================================
  // 3. SECURE OBJECT STORAGE (S3 / R2 / SSE-AES256)
  // =========================================================================
  describe('3. Cloud Storage (S3 / R2 / AES256 SSE)', () => {
    it('3.1 Generates presigned upload URL with mandatory AES256 server-side encryption header', async () => {
      const mockStorage = new MockStorageProvider();
      const result = await mockStorage.generatePresignedUploadUrl({
        storageKey: 'media/kyc_document/usr_123/aadhaar_proof.pdf',
        contentType: 'application/pdf',
        fileSizeBytes: 2 * 1024 * 1024,
      });

      assert.ok(result.uploadUrl.startsWith('https://storage.localman.in/mock-upload/'));
      assert.strictEqual(result.headers['Content-Type'], 'application/pdf');
      assert.strictEqual(result.headers['x-amz-server-side-encryption'], 'AES256');
      assert.strictEqual(result.expiresInSeconds, 900); // 15 mins default
    });

    it('3.2 Generates time-limited presigned read URL for private document access', async () => {
      const mockStorage = new MockStorageProvider();
      const readUrl = await mockStorage.generatePresignedReadUrl(
        'media/kyc_document/usr_123/aadhaar_proof.pdf',
        3600
      );

      assert.ok(readUrl.includes('aadhaar_proof.pdf'));
      assert.ok(readUrl.startsWith('https://storage.localman.in/'));
    });

    it('3.3 S3StorageProvider creates SigV4 presigned upload with AWS4 credentials', async () => {
      const s3Provider = new S3StorageProvider('s3');
      const upload = await s3Provider.generatePresignedUploadUrl({
        storageKey: 'media/job_before_work/bk_456/before_ac_repair.jpg',
        contentType: 'image/jpeg',
        fileSizeBytes: 1024 * 500,
      });

      assert.ok(upload.uploadUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'));
      assert.ok(upload.uploadUrl.includes('X-Amz-Signature='));
      assert.strictEqual(upload.headers['Content-Type'], 'image/jpeg');
      assert.strictEqual(upload.headers['x-amz-server-side-encryption'], 'AES256');
    });
  });

  // =========================================================================
  // 4. PUSH NOTIFICATIONS & FIREBASE CLOUD MESSAGING (FCM HTTP v1)
  // =========================================================================
  describe('4. Push Notifications & FCM HTTP v1 Integration', () => {
    it('4.1 DeviceTokenRegistry stores, retrieves, and prunes user device tokens', () => {
      const registry = new DeviceTokenRegistry();
      const userId = 'usr_customer_7788';

      registry.register(userId, 'fcm_token_device_android_1', 'android');
      registry.register(userId, 'fcm_token_device_web_2', 'web');

      const tokens = registry.getTokensForUser(userId);
      assert.strictEqual(tokens.length, 2);
      assert.ok(tokens.includes('fcm_token_device_android_1'));
      assert.ok(tokens.includes('fcm_token_device_web_2'));

      // Prune / Unregister
      registry.pruneToken('fcm_token_device_android_1');
      const tokensAfter = registry.getTokensForUser(userId);
      assert.strictEqual(tokensAfter.length, 1);
      assert.strictEqual(tokensAfter[0], 'fcm_token_device_web_2');
    });

    it('4.2 FcmNotificationProvider redacts sensitive secrets from push payload data', async () => {
      const registry = new DeviceTokenRegistry();
      const provider = new FcmNotificationProvider({
        projectId: 'localman-fcm-staging',
        tokenRegistry: registry,
      });

      await provider.send('usr_test_privacy', {
        title: 'Booking Confirmed',
        body: 'Your technician has arrived',
        data: {
          bookingId: 'bk_123',
          customerOtp: '998877', // SENSITIVE
          api_secret: 'super_secret', // SENSITIVE
          safeKey: 'regular_data',
        },
      });

      const records = provider.getSentRecords();
      assert.strictEqual(records.length, 1);
      const data = records[0].payload.data;
      assert.strictEqual(data?.safeKey, 'regular_data');
      assert.strictEqual(data?.customerOtp, '[REDACTED]');
      assert.strictEqual(data?.api_secret, '[REDACTED]');
    });

    it('4.3 FcmNotificationProvider automatically prunes UNREGISTERED device tokens on 404', async () => {
      const registry = new DeviceTokenRegistry();
      const userId = 'usr_provider_dead_token';
      const invalidToken = 'fcm_expired_token_xyz999';
      registry.register(userId, invalidToken, 'android');

      const mockFetch = async () => {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            error: {
              code: 404,
              status: 'NOT_FOUND',
              details: [{ errorCode: 'UNREGISTERED' }],
            },
          }),
        } as any;
      };

      const provider = new FcmNotificationProvider({
        projectId: 'localman-fcm-staging',
        tokenRegistry: registry,
        fetchFn: mockFetch as any,
      });

      await provider.send(userId, {
        title: 'New Service Request',
        body: 'Tap to accept',
      });

      // Token should be automatically pruned from registry
      const remainingTokens = registry.getTokensForUser(userId);
      assert.strictEqual(remainingTokens.length, 0);
    });

    it('4.4 FcmNotificationProvider retries with backoff on 429/503 rate limit', async () => {
      const registry = new DeviceTokenRegistry();
      const userId = 'usr_busy';
      const token = 'fcm_valid_token_busy';
      registry.register(userId, token, 'android');

      let callCount = 0;
      const mockFetch = async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 503, json: async () => ({}) } as any;
        }
        return { ok: true, status: 200, json: async () => ({ name: 'projects/p/messages/msg_1' }) } as any;
      };

      const provider = new FcmNotificationProvider({
        projectId: 'localman-fcm-staging',
        tokenRegistry: registry,
        fetchFn: mockFetch as any,
      });

      const success = await provider.send(userId, {
        title: 'Retry Test',
        body: 'Server busy resolved',
      });

      assert.strictEqual(success, true);
      assert.strictEqual(callCount, 2); // Retried once and succeeded
    });
  });

  // =========================================================================
  // 5. GOOGLE MAPS, DIRECTIONS & GEOCODING
  // =========================================================================
  describe('5. Google Maps, Directions, Geocoding & Budget Controls', () => {
    const origin = { lat: 28.6139, lng: 77.209 }; // New Delhi
    const destination = { lat: 28.5355, lng: 77.391 }; // Noida

    it('5.1 Calculates accurate Haversine straight-line distance with zero real-time flags', async () => {
      const service = new GoogleMapsService({ apiKey: 'mock_gmaps_key' });
      const route = await service.calculateRoute(origin, destination);

      assert.strictEqual(route.isRealTimeRouting, false);
      assert.strictEqual(route.durationSeconds, null);
      assert.strictEqual(route.etaMinutes, null);
      assert.strictEqual(route.status, 'FALLBACK_STRAIGHT_LINE');
      assert.ok(route.distanceMeters > 15000 && route.distanceMeters < 25000);
    });

    it('5.2 Uses in-memory cache to return cached route within 30-second TTL', async () => {
      let networkCalls = 0;
      const mockFetch = async () => {
        networkCalls++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'OK',
            routes: [{ legs: [{ distance: { value: 21500 }, duration: { value: 1800 } }] }],
          }),
        } as any;
      };

      const service = new GoogleMapsService({
        apiKey: 'AIza_real_valid_key',
        fetchFn: mockFetch as any,
        cacheTtlMs: 30000,
      });

      // Call 1: Network call executed
      const route1 = await service.calculateRoute(origin, destination, { forceLive: true });
      assert.strictEqual(route1.isRealTimeRouting, true);
      assert.strictEqual(route1.distanceMeters, 21500);
      assert.strictEqual(networkCalls, 1);

      // Call 2: Should hit memory cache without network call
      const route2 = await service.calculateRoute(origin, destination, { forceLive: true });
      assert.strictEqual(route2.cached, true);
      assert.strictEqual(route2.distanceMeters, 21500);
      assert.strictEqual(networkCalls, 1); // Still 1!
    });

    it('5.3 Budget rate limiter stops calls when minute quota exceeded and falls back gracefully', async () => {
      let networkCalls = 0;
      const mockFetch = async () => {
        networkCalls++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'OK',
            routes: [{ legs: [{ distance: { value: 1000 }, duration: { value: 60 } }] }],
          }),
        } as any;
      };

      // Set budget max to 2 requests per minute
      const service = new GoogleMapsService({
        apiKey: 'AIza_real_valid_key',
        maxRequestsPerMinute: 2,
        fetchFn: mockFetch as any,
      });

      // Request 1
      await service.calculateRoute({ lat: 10.0, lng: 10.0 }, { lat: 10.1, lng: 10.1 }, { forceLive: true });
      // Request 2
      await service.calculateRoute({ lat: 10.2, lng: 10.2 }, { lat: 10.3, lng: 10.3 }, { forceLive: true });
      // Request 3 (exceeds budget of 2)
      const route3 = await service.calculateRoute(
        { lat: 10.4, lng: 10.4 },
        { lat: 10.5, lng: 10.5 },
        { forceLive: true }
      );

      assert.strictEqual(networkCalls, 2); // Third request blocked by budget guard
      assert.strictEqual(route3.isRealTimeRouting, false);
      assert.strictEqual(route3.status, 'BUDGET_EXCEEDED_FALLBACK');
    });

    it('5.4 geocodeAddress resolves coordinates with fallback and caching', async () => {
      const service = new GoogleMapsService({ apiKey: 'mock_gmaps_key' });
      const geoResult = await service.geocodeAddress('Connaught Place, New Delhi');

      assert.strictEqual(geoResult.lat, 28.6139);
      assert.strictEqual(geoResult.lng, 77.209);
      assert.strictEqual(geoResult.formattedAddress, 'Connaught Place, New Delhi');
      assert.strictEqual(geoResult.status, 'FALLBACK_GEOCODE');

      // Cached second call
      const cachedGeo = await service.geocodeAddress('Connaught Place, New Delhi');
      assert.strictEqual(cachedGeo.cached, true);
    });
  });
});
