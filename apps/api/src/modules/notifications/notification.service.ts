import { env } from '../../config/env.js';
import { realtimeService } from '../realtime/realtime.service.js';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: 'DISPATCH' | 'BOOKING' | 'PAYMENT' | 'SYSTEM';
}

export interface NotificationRecord {
  id: string;
  recipientUserId: string;
  payload: NotificationPayload;
  deliveredAt: string;
  channel: 'DEV_ADAPTER' | 'FCM' | 'IN_APP';
  deviceTokensCount?: number;
}

export interface INotificationProvider {
  readonly providerName: string;
  send(recipientUserId: string, payload: NotificationPayload): Promise<boolean>;
}

export interface DeviceTokenInfo {
  token: string;
  platform: 'android' | 'ios' | 'web';
  registeredAt: Date;
}

/**
 * Thread-safe In-Memory Device Token Registry for active FCM push tokens.
 */
export class DeviceTokenRegistry {
  private userTokens = new Map<string, Map<string, DeviceTokenInfo>>();

  register(userId: string, token: string, platform: 'android' | 'ios' | 'web' = 'android'): void {
    if (!token || !userId) return;
    let tokens = this.userTokens.get(userId);
    if (!tokens) {
      tokens = new Map();
      this.userTokens.set(userId, tokens);
    }
    tokens.set(token, {
      token,
      platform,
      registeredAt: new Date(),
    });
  }

  unregister(token: string): boolean {
    let removed = false;
    for (const [, tokens] of this.userTokens.entries()) {
      if (tokens.delete(token)) {
        removed = true;
      }
    }
    return removed;
  }

  getTokensForUser(userId: string): string[] {
    const tokens = this.userTokens.get(userId);
    if (!tokens) return [];
    return Array.from(tokens.keys());
  }

  pruneToken(token: string): void {
    this.unregister(token);
  }

  clear(): void {
    this.userTokens.clear();
  }

  count(): number {
    let total = 0;
    for (const tokens of this.userTokens.values()) {
      total += tokens.size;
    }
    return total;
  }
}

export const globalDeviceTokens = new DeviceTokenRegistry();

/**
 * Safe development adapter that records notifications and pushes to RealtimeService
 * without requiring real production FCM credentials.
 */
export class DevNotificationAdapter implements INotificationProvider {
  public readonly providerName = 'mock';
  private sentNotifications: NotificationRecord[] = [];

  async send(recipientUserId: string, payload: NotificationPayload): Promise<boolean> {
    const record: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientUserId,
      payload,
      deliveredAt: new Date().toISOString(),
      channel: 'DEV_ADAPTER',
    };
    this.sentNotifications.push(record);
    return true;
  }

  getSentNotifications(): NotificationRecord[] {
    return [...this.sentNotifications];
  }

  clear(): void {
    this.sentNotifications = [];
  }
}

export interface FcmProviderOptions {
  projectId?: string;
  serviceAccountKey?: string;
  fetchFn?: typeof fetch;
  tokenRegistry?: DeviceTokenRegistry;
}

/**
 * Firebase Cloud Messaging (FCM) HTTP v1 Production Notification Provider
 * Implements Google FCM HTTP v1 REST protocol with token pruning, retry backoff,
 * and privacy redaction.
 */
export class FcmNotificationProvider implements INotificationProvider {
  public readonly providerName = 'fcm';
  private projectId: string;
  private serviceAccountKey?: string;
  private fetchFn: typeof fetch;
  private tokenRegistry: DeviceTokenRegistry;
  private sentRecords: NotificationRecord[] = [];

  constructor(options: FcmProviderOptions = {}) {
    this.projectId = options.projectId ?? env.FCM_PROJECT_ID ?? '';
    this.serviceAccountKey = options.serviceAccountKey ?? env.FCM_SERVICE_ACCOUNT_KEY;
    this.fetchFn = options.fetchFn ?? fetch;
    this.tokenRegistry = options.tokenRegistry ?? globalDeviceTokens;
  }

  public getSentRecords(): NotificationRecord[] {
    return [...this.sentRecords];
  }

  /**
   * Sanitizes payload data to ensure no sensitive credentials, secrets, or OTPs leak.
   */
  private sanitizePayload(payload: NotificationPayload): NotificationPayload {
    const sensitiveKeys = ['otp', 'password', 'token', 'secret', 'cvv', 'card'];
    const sanitizedData: Record<string, string> = {};

    if (payload.data) {
      for (const [key, val] of Object.entries(payload.data)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
          sanitizedData[key] = '[REDACTED]';
        } else {
          sanitizedData[key] = String(val);
        }
      }
    }

    return {
      title: payload.title,
      body: payload.body,
      data: sanitizedData,
      category: payload.category,
    };
  }

  async send(recipientUserId: string, payload: NotificationPayload): Promise<boolean> {
    const sanitized = this.sanitizePayload(payload);
    const tokens = this.tokenRegistry.getTokensForUser(recipientUserId);

    const record: NotificationRecord = {
      id: `fcm_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientUserId,
      payload: sanitized,
      deliveredAt: new Date().toISOString(),
      channel: 'FCM',
      deviceTokensCount: tokens.length,
    };
    this.sentRecords.push(record);

    if (tokens.length === 0) {
      return true;
    }

    if (!this.projectId) {
      console.warn('[FCM] No FCM_PROJECT_ID configured. Notifications logged locally.');
      return true;
    }

    // Dispatch to registered device tokens
    for (const token of tokens) {
      await this.dispatchToToken(token, sanitized);
    }

    return true;
  }

  private async dispatchToToken(token: string, payload: NotificationPayload): Promise<boolean> {
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
      this.projectId
    )}/messages:send`;

    const fcmMessage = {
      message: {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channel_id: 'localman_service_alerts',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
      },
    };

    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.serviceAccountKey
              ? `Bearer ${this.serviceAccountKey}`
              : `Bearer mock_oauth2_token_or_service_account`,
          },
          body: JSON.stringify(fcmMessage),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          return true;
        }

        // Handle unregistered / invalid tokens: prune immediately from registry
        if (response.status === 404 || response.status === 400) {
          const errData = (await response.json().catch(() => ({}))) as any;
          const errorCode = errData?.error?.details?.[0]?.errorCode || errData?.error?.status;
          if (
            errorCode === 'UNREGISTERED' ||
            errorCode === 'NOT_FOUND' ||
            errorCode === 'INVALID_ARGUMENT'
          ) {
            console.info(`[FCM] Token unregistered or expired. Pruning token: ${token.slice(0, 8)}...`);
            this.tokenRegistry.pruneToken(token);
            return false;
          }
        }

        // Handle rate limiting / server busy: retry with backoff
        if (response.status === 429 || response.status === 503) {
          if (attempts < maxAttempts) {
            await new Promise((res) => setTimeout(res, 100 * attempts));
            continue;
          }
        }

        return false;
      } catch (err: any) {
        if (attempts >= maxAttempts) {
          console.warn(`[FCM] Failed to dispatch push message: ${err.message}`);
          return false;
        }
      }
    }

    return false;
  }
}

export class NotificationService {
  private static instance: NotificationService;
  private provider: INotificationProvider;
  public readonly deviceTokens: DeviceTokenRegistry;

  private constructor() {
    this.deviceTokens = globalDeviceTokens;
    if (env.NOTIFICATION_PROVIDER === 'fcm' && env.FCM_PROJECT_ID) {
      this.provider = new FcmNotificationProvider({
        projectId: env.FCM_PROJECT_ID,
        serviceAccountKey: env.FCM_SERVICE_ACCOUNT_KEY,
        tokenRegistry: this.deviceTokens,
      });
    } else {
      this.provider = new DevNotificationAdapter();
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public setProvider(provider: INotificationProvider): void {
    this.provider = provider;
  }

  public getProvider(): INotificationProvider {
    return this.provider;
  }

  /**
   * Registers a customer or provider device token for push delivery.
   */
  public registerDeviceToken(userId: string, token: string, platform: 'android' | 'ios' | 'web' = 'android'): void {
    this.deviceTokens.register(userId, token, platform);
  }

  /**
   * Unregisters a device token upon logout.
   */
  public unregisterDeviceToken(token: string): boolean {
    return this.deviceTokens.unregister(token);
  }

  /**
   * Dispatches notification to a user via the active provider adapter
   */
  async notifyUser(recipientUserId: string, payload: NotificationPayload): Promise<boolean> {
    return this.provider.send(recipientUserId, payload);
  }

  /**
   * Convenience helpers for dispatch domain events
   */
  async notifyProviderNewOffer(userId: string, providerId: string, bookingNumber: string, serviceTitle: string, offerId: string): Promise<void> {
    await this.notifyUser(userId, {
      title: 'New Service Job Offered!',
      body: `You have received a new request for ${serviceTitle} (#${bookingNumber}). Review and respond promptly.`,
      category: 'DISPATCH',
      data: { offerId, bookingNumber, type: 'BOOKING_OFFERED' },
    });
    realtimeService.emitToProvider(providerId, 'BOOKING_OFFERED', { offerId, bookingNumber, serviceTitle });
  }

  async notifyCustomerBookingAccepted(customerId: string, bookingNumber: string, providerName: string): Promise<void> {
    await this.notifyUser(customerId, {
      title: 'Service Partner Assigned!',
      body: `${providerName} has accepted your booking #${bookingNumber} and will arrive as scheduled.`,
      category: 'BOOKING',
      data: { bookingNumber, type: 'BOOKING_ACCEPTED' },
    });
    realtimeService.emitToCustomer(customerId, 'BOOKING_ACCEPTED', { bookingNumber, providerName });
  }

  async notifyProviderOfferExpired(userId: string, providerId: string, bookingNumber: string): Promise<void> {
    await this.notifyUser(userId, {
      title: 'Job Offer Expired',
      body: `The dispatch window for booking #${bookingNumber} has closed.`,
      category: 'DISPATCH',
      data: { bookingNumber, type: 'BOOKING_EXPIRED' },
    });
    realtimeService.emitToProvider(providerId, 'BOOKING_EXPIRED', { bookingNumber });
  }

  async notifyCustomerNoProvider(customerId: string, bookingNumber: string): Promise<void> {
    await this.notifyUser(customerId, {
      title: 'Searching for Partners',
      body: `We are searching for more available service partners for your booking #${bookingNumber}.`,
      category: 'BOOKING',
      data: { bookingNumber, type: 'DISPATCH_FAILED' },
    });
    realtimeService.emitToCustomer(customerId, 'DISPATCH_FAILED', { bookingNumber });
  }

  async notifyCustomerProviderOnTheWay(customerId: string, bookingNumber: string, providerName: string): Promise<void> {
    await this.notifyUser(customerId, {
      title: 'Partner is on the way!',
      body: `${providerName} has started heading to your location for booking #${bookingNumber}.`,
      category: 'BOOKING',
      data: { bookingNumber, type: 'JOB_STATUS_CHANGED', status: 'PROVIDER_ON_THE_WAY' },
    });
    realtimeService.emitToCustomer(customerId, 'JOB_STATUS_CHANGED', { bookingNumber, status: 'PROVIDER_ON_THE_WAY' });
  }

  async notifyCustomerProviderArrived(customerId: string, bookingNumber: string, providerName: string): Promise<void> {
    await this.notifyUser(customerId, {
      title: 'Partner has arrived!',
      body: `${providerName} has arrived at your location for booking #${bookingNumber}. Share your Start OTP to begin.`,
      category: 'BOOKING',
      data: { bookingNumber, type: 'JOB_STATUS_CHANGED', status: 'ARRIVED' },
    });
    realtimeService.emitToCustomer(customerId, 'JOB_STATUS_CHANGED', { bookingNumber, status: 'ARRIVED' });
  }

  async notifyCustomerJobStarted(customerId: string, bookingNumber: string, providerName: string): Promise<void> {
    await this.notifyUser(customerId, {
      title: 'Service in progress',
      body: `${providerName} has verified your Start OTP and begun work on booking #${bookingNumber}.`,
      category: 'BOOKING',
      data: { bookingNumber, type: 'JOB_STATUS_CHANGED', status: 'JOB_STARTED' },
    });
    realtimeService.emitToCustomer(customerId, 'JOB_STATUS_CHANGED', { bookingNumber, status: 'JOB_STARTED' });
  }

  async notifyCustomerJobCompleted(customerId: string, bookingNumber: string, providerName: string): Promise<void> {
    await this.notifyUser(customerId, {
      title: 'Service completed!',
      body: `${providerName} has completed work on booking #${bookingNumber}. Please review the summary.`,
      category: 'BOOKING',
      data: { bookingNumber, type: 'JOB_STATUS_CHANGED', status: 'JOB_COMPLETED' },
    });
    realtimeService.emitToCustomer(customerId, 'JOB_STATUS_CHANGED', { bookingNumber, status: 'JOB_COMPLETED' });
  }

  async notifyPaymentConfirmed(customerId: string, bookingNumber: string, amountPaisa: number): Promise<void> {
    const rupees = (amountPaisa / 100).toFixed(2);
    await this.notifyUser(customerId, {
      title: 'Payment Successful!',
      body: `Your payment of ₹${rupees} for booking #${bookingNumber} was successfully processed. Thank you!`,
      category: 'BOOKING',
      data: { bookingNumber, type: 'PAYMENT_CONFIRMED', status: 'PAYMENT_SETTLED' },
    });
    realtimeService.emitToCustomer(customerId, 'PAYMENT_CONFIRMED', { bookingNumber, amountPaisa });
  }

  async notifyProviderPaymentSettled(userId: string, providerId: string, bookingNumber: string, netPaisa: number): Promise<void> {
    const rupees = (netPaisa / 100).toFixed(2);
    await this.notifyUser(userId, {
      title: 'Payment Settled to Wallet',
      body: `Earnings of ₹${rupees} from booking #${bookingNumber} have been credited to your wallet balance.`,
      category: 'PAYMENT',
      data: { bookingNumber, type: 'WALLET_CREDITED', netPaisa: String(netPaisa) },
    });
    realtimeService.emitToProvider(providerId, 'WALLET_CREDITED', { bookingNumber, netPaisa });
  }

  async notifyBookingCancelled(userId: string, bookingNumber: string, reason: string): Promise<void> {
    await this.notifyUser(userId, {
      title: 'Booking Cancelled',
      body: `Booking #${bookingNumber} has been cancelled: ${reason}.`,
      category: 'BOOKING',
      data: { bookingNumber, type: 'BOOKING_CANCELLED' },
    });
  }

  async notifyReviewReceived(providerUserId: string, providerId: string, bookingId: string, rating: number): Promise<void> {
    await this.notifyUser(providerUserId, {
      title: 'New Review Received',
      body: `A customer has rated your service ${rating} / 5 stars. Check it out in your profile!`,
      category: 'BOOKING',
      data: { bookingId, rating: String(rating), type: 'REVIEW_RECEIVED' },
    });
    realtimeService.emitToProvider(providerId, 'REVIEW_CREATED', { bookingId, rating });
  }

  async notifyProviderResponseReceived(customerUserId: string, bookingId: string, providerName: string): Promise<void> {
    await this.notifyUser(customerUserId, {
      title: 'Professional Responded to Your Review',
      body: `${providerName} has responded to your review.`,
      category: 'BOOKING',
      data: { bookingId, type: 'PROVIDER_RESPONDED_TO_REVIEW' },
    });
    realtimeService.emitToCustomer(customerUserId, 'PROVIDER_RESPONDED_TO_REVIEW', { bookingId });
  }
}

export const notificationService = NotificationService.getInstance();
