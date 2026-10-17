import crypto from 'node:crypto';

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
export function generateSecureOtp(): string {
  const randomBuffer = crypto.randomBytes(4);
  const randomNumber = randomBuffer.readUInt32BE(0);
  const otp = (randomNumber % 900000) + 100000;
  return otp.toString();
}

/**
 * Creates SHA-256 hash for secure token/OTP storage
 */
export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generates an idempotent booking number, e.g. LM-20261017-X82A
 */
export function generateBookingNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `LM-${dateStr}-${randomSuffix}`;
}
