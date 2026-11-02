import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { generateSecureOtp, hashString } from '../../common/utils/crypto.js';
import { AppError, UnauthorizedError, ValidationError } from '../../common/errors/app-error.js';
import { getSmsGateway } from './sms-gateway.interface.js';
import { monitoringService } from '../monitoring/monitoring.service.js';
import {
  SendOtpInput,
  VerifyOtpInput,
  AuthResponse,
  UpdateProfileInput,
} from '@localman/contracts';

export class AuthService {
  private get smsGateway() {
    return getSmsGateway();
  }

  /**
   * Generates and dispatches a 6-digit OTP to the Indian mobile number
   */
  async sendOtp(input: SendOtpInput) {
    const { phoneNumber, phoneCountryCode, role } = input;

    // 1. Resend Cooldown Check: Minimum 60 seconds between consecutive OTP requests
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const recentOtp = await prisma.otpVerification.findFirst({
      where: {
        phoneNumber,
        createdAt: { gte: sixtySecondsAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      const waitSeconds = Math.max(
        1,
        Math.ceil((recentOtp.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000)
      );
      throw new AppError(
        `Please wait ${waitSeconds} seconds before requesting another verification code.`,
        429,
        'RESEND_COOLDOWN'
      );
    }

    // 2. Rolling Rate Limiting Check: Max 3 OTP requests in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentOtpsCount = await prisma.otpVerification.count({
      where: {
        phoneNumber,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentOtpsCount >= 3) {
      monitoringService.recordOtpFailure({
        phoneNumber,
        reason: 'RATE_LIMIT_EXCEEDED (Max 3 requests / 15 mins)',
      });
      throw new AppError(
        'Too many OTP requests. For your security, please wait 15 minutes before trying again.',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    const otp = generateSecureOtp();
    const otpHash = hashString(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save hashed OTP in database
    await prisma.otpVerification.create({
      data: {
        phoneNumber,
        otpHash,
        role,
        expiresAt,
      },
    });

    // Send SMS via Gateway
    const fullPhone = `${phoneCountryCode}${phoneNumber}`;
    await this.smsGateway.sendOtp({
      toPhoneNumber: fullPhone,
      message: `Your LOCALMAN verification code is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`,
      otpCode: otp,
    });

    return {
      message: 'OTP dispatched successfully',
      phoneNumber,
      expiresInSeconds: 600,
    };
  }

  /**
   * Verifies the submitted OTP, creates or retrieves user, assigns role, and returns JWT tokens
   */
  async verifyOtp(fastify: FastifyInstance, input: VerifyOtpInput): Promise<AuthResponse> {
    const { phoneNumber, phoneCountryCode, otp, role } = input;

    // Find the latest valid OTP record for this phone
    const verification = await prisma.otpVerification.findFirst({
      where: {
        phoneNumber,
        isConsumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new ValidationError('Invalid or expired OTP. Please request a new code.');
    }

    // Check failed attempts
    if (verification.attempts >= 5) {
      monitoringService.recordOtpFailure({
        phoneNumber,
        reason: 'OTP_LOCKED (5 failed attempts reached)',
        attemptCount: verification.attempts,
      });
      throw new AppError(
        'Too many failed attempts. This OTP is locked. Please request a new code.',
        429,
        'OTP_LOCKED'
      );
    }

    // Verify Hash
    const submittedHash = hashString(otp);
    if (submittedHash !== verification.otpHash) {
      await prisma.otpVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new ValidationError('Incorrect OTP. Please enter the valid 6-digit code.');
    }

    // Mark consumed
    await prisma.otpVerification.update({
      where: { id: verification.id },
      data: { isConsumed: true },
    });

    // Upsert User
    const user = await prisma.user.upsert({
      where: { phoneNumber },
      update: {
        isPhoneVerified: true,
      },
      create: {
        phoneCountryCode,
        phoneNumber,
        isPhoneVerified: true,
      },
      include: {
        userRoles: true,
        provider: true,
      },
    });

    // Ensure Role is attached
    const hasRole = user.userRoles.some((ur) => ur.roleId === role);
    if (!hasRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role,
        },
      });
    }

    // If logging in as PROVIDER, ensure Provider profile record exists
    if (role === 'PROVIDER' && !user.provider) {
      await prisma.provider.create({
        data: {
          userId: user.id,
          verificationStatus: 'DRAFT',
        },
      });
    }

    // Generate JWT access & refresh tokens
    const accessToken = fastify.jwt.sign(
      {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        roles: [...user.userRoles.map((r) => r.roleId), role],
      },
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    const refreshToken = fastify.jwt.sign(
      { userId: user.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN }
    );

    // Persist hashed refresh token for rotation, revocation & replay protection
    const tokenHash = hashString(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        isRevoked: false,
      },
    });

    const isProfileComplete = Boolean(user.fullName && user.fullName.trim().length > 0);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        roles: Array.from(new Set([...user.userRoles.map((r) => r.roleId), role])),
        isProfileComplete,
      },
    };
  }

  /**
   * Refreshes access token with automatic refresh token rotation & replay detection
   */
  async refreshToken(fastify: FastifyInstance, submittedToken: string) {
    let decoded: { userId: string; type: string } | null = null;
    try {
      decoded = fastify.jwt.verify<{ userId: string; type: string }>(submittedToken);
    } catch {
      throw new UnauthorizedError('Refresh token expired or invalid');
    }

    if (!decoded || decoded.type !== 'refresh' || !decoded.userId) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const tokenHash = hashString(submittedToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Replay attack detection: token was already revoked/rotated
    if (storedToken.isRevoked) {
      // Security measure: revoke all active refresh tokens for this user
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedError('Refresh token replay detected. All sessions revoked for security.');
    }

    // Expiration check against stored expiration
    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: { userRoles: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or suspended');
    }

    // Issue new access token
    const newAccessToken = fastify.jwt.sign(
      {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        roles: user.userRoles.map((r) => r.roleId),
      },
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    // Rotate: Issue new refresh token
    const newRefreshToken = fastify.jwt.sign(
      { userId: user.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN }
    );
    const newTokenHash = hashString(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Atomically revoke current token and persist newly rotated token
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          isRevoked: true,
          replacedBy: newTokenHash,
        },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
          isRevoked: false,
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Explicitly revokes a refresh token (e.g. on logout)
   */
  async revokeRefreshToken(token: string) {
    const tokenHash = hashString(token);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
    return { success: true };
  }

  /**
   * Updates basic profile details
   */
  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        email: input.email,
        preferredLanguage: input.preferredLanguage,
      },
    });

    return {
      id: updated.id,
      phoneNumber: updated.phoneNumber,
      fullName: updated.fullName,
      email: updated.email,
      preferredLanguage: updated.preferredLanguage,
    };
  }

  /**
   * Retrieves profile of currently authenticated user
   */
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: true,
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
        provider: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      preferredLanguage: user.preferredLanguage,
      roles: user.userRoles.map((ur) => ur.roleId),
      isProfileComplete: Boolean(user.fullName && user.fullName.trim().length > 0),
      addresses: user.addresses,
      provider: user.provider
        ? {
            id: user.provider.id,
            businessName: user.provider.businessName,
            verificationStatus: user.provider.verificationStatus,
            isOnline: user.provider.isOnline,
            ratingAverage: Number(user.provider.ratingAverage),
            ratingCount: user.provider.ratingCount,
          }
        : null,
    };
  }
}
