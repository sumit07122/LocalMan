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
}

export interface INotificationProvider {
  send(recipientUserId: string, payload: NotificationPayload): Promise<boolean>;
}

/**
 * Safe development adapter that records notifications and pushes to RealtimeService
 * without requiring real production FCM credentials.
 */
export class DevNotificationAdapter implements INotificationProvider {
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

export class NotificationService {
  private static instance: NotificationService;
  private provider: INotificationProvider;

  private constructor() {
    this.provider = new DevNotificationAdapter();
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
