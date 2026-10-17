import { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { generateSecureOtp, hashString } from '../../common/utils/crypto.js';
import { AppError, UnauthorizedError, ValidationError } from '../../common/errors/app-error.js';
import { getSmsGateway } from './sms-gateway.interface.js';
import {
  SendOtpInput,
  VerifyOtpInput,
  AuthResponse,
  UpdateProfileInput,
} from '@localman/contracts';

export class AuthService {
  private smsGateway = getSmsGateway();

  /**
   * Generates and dispatches a 6-digit OTP to the Indian mobile number
   */
  async sendOtp(input: SendOtpInput) {
    const { phoneNumber, phoneCountryCode, role } = input;

    // Rate Limiting Check: Max 3 OTP requests in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentOtpsCount = await prisma.otpVerification.count({
      where: {
        phoneNumber,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentOtpsCount >= 3) {
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
      { userId: user.id, type: 'refresh' },
      { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN }
    );

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
   * Refreshes access token using valid refresh token
   */
  async refreshToken(fastify: FastifyInstance, refreshToken: string) {
    try {
      const decoded = fastify.jwt.verify<{ userId: string; type: string }>(refreshToken);
      if (!decoded || decoded.type !== 'refresh' || !decoded.userId) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { userRoles: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('User account not found or suspended');
      }

      const newAccessToken = fastify.jwt.sign(
        {
          userId: user.id,
          phoneNumber: user.phoneNumber,
          roles: user.userRoles.map((r) => r.roleId),
        },
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      return {
        accessToken: newAccessToken,
      };
    } catch {
      throw new UnauthorizedError('Refresh token expired or invalid');
    }
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
