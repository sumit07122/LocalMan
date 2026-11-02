/**
 * LocalMan Enterprise Production Monitoring & Reliability Service
 * Provides structured alert tracking for payment failures, OTP anomalies,
 * dispatch failures, database disconnections, and security events.
 * 
 * Strict Privacy Invariant:
 * NEVER logs tokens, OTPs, full KYC identifiers, or payment credentials.
 */

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AlertRecord {
  id: string;
  category: 'PAYMENT' | 'OTP' | 'DISPATCH' | 'DATABASE' | 'SECURITY';
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface PaymentFailureAlert {
  bookingId?: string;
  paymentId?: string;
  gateway?: string;
  gatewayOrderId?: string;
  amountPaisa?: number;
  reason: string;
  errorCode?: string;
}

export interface OtpFailureAlert {
  phoneNumber: string;
  reason: string;
  attemptCount?: number;
}

export interface DispatchFailureAlert {
  bookingId: string;
  serviceCategory?: string;
  attemptNumber: number;
  reason: string;
}

export interface DatabaseFailureAlert {
  operation: string;
  error: string;
  durationMs?: number;
}

export interface SecurityAlert {
  type: string;
  ip?: string;
  userId?: string;
  targetResource?: string;
  reason: string;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private alerts: AlertRecord[] = [];
  private readonly maxAlerts = 500; // In-memory ring buffer

  private constructor() {}

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Sanitizes phone numbers to prevent plaintext PII leaks in monitoring logs
   */
  public maskPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.trim();
    if (cleaned.length <= 4) return '****';
    const visiblePrefix = cleaned.slice(0, 5);
    const visibleSuffix = cleaned.slice(-4);
    return `${visiblePrefix}****${visibleSuffix}`;
  }

  /**
   * Sanitizes sensitive fields from metadata before logging or storing
   */
  private sanitizeMetadata(data: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['otp', 'password', 'token', 'secret', 'cvv', 'key', 'card', 'aadhaar', 'pan'];
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private pushAlert(category: AlertRecord['category'], severity: AlertSeverity, message: string, metadata: Record<string, any>) {
    const record: AlertRecord = {
      id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category,
      severity,
      message,
      metadata: this.sanitizeMetadata(metadata),
      timestamp: new Date().toISOString(),
    };

    this.alerts.unshift(record);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }

    // Structured JSON log output for external log forwarders (Datadog/CloudWatch/Render logs)
    const logPayload = JSON.stringify({
      level: severity === 'CRITICAL' || severity === 'HIGH' ? 'error' : 'warn',
      alertId: record.id,
      category: record.category,
      severity: record.severity,
      message: record.message,
      timestamp: record.timestamp,
      ...record.metadata,
    });

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      console.error(`🚨 [LOCALMAN_ALERT] ${logPayload}`);
    } else {
      console.warn(`⚠️ [LOCALMAN_ALERT] ${logPayload}`);
    }
  }

  /**
   * Records payment failures (gateway rejections, forged signatures, refund failures)
   */
  public recordPaymentFailure(alert: PaymentFailureAlert): void {
    const amountInr = alert.amountPaisa ? (alert.amountPaisa / 100).toFixed(2) : undefined;
    this.pushAlert(
      'PAYMENT',
      alert.errorCode === 'INVALID_SIGNATURE' ? 'CRITICAL' : 'HIGH',
      `Payment failure detected: ${alert.reason}`,
      {
        bookingId: alert.bookingId,
        paymentId: alert.paymentId,
        gateway: alert.gateway,
        gatewayOrderId: alert.gatewayOrderId,
        amountPaisa: alert.amountPaisa,
        amountInr,
        reason: alert.reason,
        errorCode: alert.errorCode,
      }
    );
  }

  /**
   * Records OTP dispatch / verification failures (rate limit breach, locked attempt threshold)
   */
  public recordOtpFailure(alert: OtpFailureAlert): void {
    this.pushAlert(
      'OTP',
      alert.reason.includes('LOCKED') ? 'HIGH' : 'MEDIUM',
      `OTP failure: ${alert.reason}`,
      {
        maskedPhone: this.maskPhoneNumber(alert.phoneNumber),
        reason: alert.reason,
        attemptCount: alert.attemptCount,
      }
    );
  }

  /**
   * Records dispatch failures (no provider found, all broadcast offers expired)
   */
  public recordDispatchFailure(alert: DispatchFailureAlert): void {
    this.pushAlert(
      'DISPATCH',
      alert.attemptNumber >= 3 ? 'HIGH' : 'MEDIUM',
      `Dispatch search failure for booking #${alert.bookingId}: ${alert.reason}`,
      {
        bookingId: alert.bookingId,
        serviceCategory: alert.serviceCategory,
        attemptNumber: alert.attemptNumber,
        reason: alert.reason,
      }
    );
  }

  /**
   * Records database connectivity or query execution failures
   */
  public recordDatabaseFailure(alert: DatabaseFailureAlert): void {
    this.pushAlert(
      'DATABASE',
      'CRITICAL',
      `Database error during ${alert.operation}: ${alert.error}`,
      {
        operation: alert.operation,
        error: alert.error,
        durationMs: alert.durationMs,
      }
    );
  }

  /**
   * Records security policy violations (CORS rejection, IDOR attempt, unauthorized admin route access)
   */
  public recordSecurityEvent(alert: SecurityAlert): void {
    this.pushAlert(
      'SECURITY',
      'HIGH',
      `Security violation: ${alert.type} - ${alert.reason}`,
      {
        type: alert.type,
        ip: alert.ip,
        userId: alert.userId,
        targetResource: alert.targetResource,
        reason: alert.reason,
      }
    );
  }

  /**
   * Retrieves recent alerts for admin oversight
   */
  public getRecentAlerts(limit = 50): AlertRecord[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Clears alerts (useful in test runs)
   */
  public clear(): void {
    this.alerts = [];
  }

  /**
   * Returns operational reliability health statistics
   */
  public getHealthSummary() {
    const counts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      PAYMENT_FAILURES: 0,
      OTP_FAILURES: 0,
      DISPATCH_FAILURES: 0,
      DATABASE_FAILURES: 0,
      SECURITY_EVENTS: 0,
    };

    for (const a of this.alerts) {
      counts[a.severity]++;
      if (a.category === 'PAYMENT') counts.PAYMENT_FAILURES++;
      if (a.category === 'OTP') counts.OTP_FAILURES++;
      if (a.category === 'DISPATCH') counts.DISPATCH_FAILURES++;
      if (a.category === 'DATABASE') counts.DATABASE_FAILURES++;
      if (a.category === 'SECURITY') counts.SECURITY_EVENTS++;
    }

    return {
      totalAlerts: this.alerts.length,
      counts,
      isSystemHealthy: counts.CRITICAL === 0,
    };
  }
}

export const monitoringService = MonitoringService.getInstance();
