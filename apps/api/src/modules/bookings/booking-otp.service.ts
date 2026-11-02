import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { ValidationError, TooManyRequestsError } from '../../common/errors/app-error.js';

export interface BookingOtpMetadata {
  failedAttempts: number;
  lastAttemptAt?: number;
  isLocked?: boolean;
}

export class BookingOtpService {
  private static instance: BookingOtpService;
  private attemptStore = new Map<string, BookingOtpMetadata>();

  // Maximum allowed failed OTP attempts before locking verification
  private readonly MAX_FAILED_ATTEMPTS = 5;

  // Maximum expiration lifetime: 24 hours (in milliseconds)
  private readonly OTP_LIFETIME_MS = 24 * 60 * 60 * 1000;

  public static getInstance(): BookingOtpService {
    if (!BookingOtpService.instance) {
      BookingOtpService.instance = new BookingOtpService();
    }
    return BookingOtpService.instance;
  }

  /**
   * Hashes a 6-digit start OTP using HMAC-SHA256 keyed with the server secret BOOKING_OTP_PEPPER.
   * This prevents offline dictionary attacks and rainbow table lookups if database hashes are exposed.
   */
  public static hashOtp(otp: string): string {
    const pepper = env.BOOKING_OTP_PEPPER || 'localman_secure_booking_otp_pepper_secret_2026';
    return crypto.createHmac('sha256', pepper).update(otp).digest('hex');
  }

  /**
   * Resets all stored OTP attempt tracking (used for test isolation).
   */
  public resetAll(): void {
    this.attemptStore.clear();
  }

  /**
   * Resets OTP attempt tracking for a specific booking.
   */
  public resetBooking(bookingId: string): void {
    this.attemptStore.delete(bookingId);
  }

  /**
   * Retrieves failed attempt count for a booking.
   */
  public getFailedAttempts(bookingId: string): number {
    return this.attemptStore.get(bookingId)?.failedAttempts || 0;
  }

  /**
   * Checks whether the OTP verification has been locked due to excessive failed attempts.
   */
  public isLocked(bookingId: string): boolean {
    const meta = this.attemptStore.get(bookingId);
    return Boolean(meta && meta.failedAttempts >= this.MAX_FAILED_ATTEMPTS);
  }

  /**
   * Authoritatively verifies the submitted start OTP against the expected OTP stored on the booking.
   * Enforces:
   * 1. 6-digit numeric format validation
   * 2. Brute-force protection & maximum attempt lockout
   * 3. Expiration validation (24h)
   * 4. Constant-time timing-attack safe comparison
   */
  public verifyStartOtp(
    booking: {
      id: string;
      startOtp?: string;
      startOtpHash?: string;
      createdAt?: Date | string;
      scheduledDate?: Date | string;
    },
    submittedOtp: string | undefined | null
  ): void {
    const bookingId = booking.id;

    // 1. Brute-force lockout check
    if (this.isLocked(bookingId)) {
      throw new TooManyRequestsError(
        'Maximum Start OTP verification attempts exceeded (5). For customer protection, verification has been locked. Please contact support.'
      );
    }

    // 2. Format validation
    if (!submittedOtp || typeof submittedOtp !== 'string') {
      throw new ValidationError('Customer Start OTP is required.');
    }

    const cleanedOtp = submittedOtp.trim();
    if (!/^\d{6}$/.test(cleanedOtp)) {
      throw new ValidationError('Start OTP must be exactly 6 numeric digits.');
    }

    // 3. Expiration validation
    if (booking.createdAt) {
      const createdTime = new Date(booking.createdAt).getTime();
      if (!isNaN(createdTime) && Date.now() - createdTime > this.OTP_LIFETIME_MS) {
        throw new ValidationError('The Customer Start OTP has expired. Please request a new verification code.');
      }
    }

    // 4. Timing-attack safe comparison
    // Multi-tier matching:
    // Tier 1: HMAC-SHA256 with BOOKING_OTP_PEPPER (strongest production defense against rainbow tables)
    // Tier 2: Unkeyed SHA-256 fallback (backward compatibility with earlier hashes)
    // Tier 3: Plaintext startOtp fallback (backward compatibility with legacy test fixtures)
    let isMatch = false;
    const pepper = env.BOOKING_OTP_PEPPER || 'localman_secure_booking_otp_pepper_secret_2026';

    if (booking.startOtpHash) {
      // Tier 1: Keyed HMAC-SHA256
      const submittedHmac = crypto.createHmac('sha256', pepper).update(cleanedOtp).digest('hex');
      const expectedHashBuffer = Buffer.from(booking.startOtpHash);
      const submittedHmacBuffer = Buffer.from(submittedHmac);
      if (
        expectedHashBuffer.length === submittedHmacBuffer.length &&
        crypto.timingSafeEqual(expectedHashBuffer, submittedHmacBuffer)
      ) {
        isMatch = true;
      } else {
        // Tier 2: Unkeyed SHA-256 fallback
        const submittedSha = crypto.createHash('sha256').update(cleanedOtp).digest('hex');
        const submittedShaBuffer = Buffer.from(submittedSha);
        if (
          expectedHashBuffer.length === submittedShaBuffer.length &&
          crypto.timingSafeEqual(expectedHashBuffer, submittedShaBuffer)
        ) {
          isMatch = true;
        }
      }
    }

    // Tier 3: Plaintext fallback if no hash matched or hash was missing
    if (!isMatch && booking.startOtp) {
      const expectedPlainBuffer = Buffer.from(booking.startOtp);
      const submittedPlainBuffer = Buffer.from(cleanedOtp);
      if (
        expectedPlainBuffer.length === submittedPlainBuffer.length &&
        crypto.timingSafeEqual(expectedPlainBuffer, submittedPlainBuffer)
      ) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      const currentMeta = this.attemptStore.get(bookingId) || { failedAttempts: 0 };
      currentMeta.failedAttempts += 1;
      currentMeta.lastAttemptAt = Date.now();
      this.attemptStore.set(bookingId, currentMeta);

      const remainingAttempts = Math.max(0, this.MAX_FAILED_ATTEMPTS - currentMeta.failedAttempts);

      if (currentMeta.failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
        throw new TooManyRequestsError(
          'Maximum Start OTP verification attempts exceeded (5). For customer protection, verification has been locked. Please contact support.'
        );
      }

      throw new ValidationError(
        `Invalid Customer Start OTP. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
      );
    }

    // On successful verification, clear any failed attempts
    this.attemptStore.delete(bookingId);
  }
}

export const bookingOtpService = BookingOtpService.getInstance();
