import { EventEmitter } from 'events';

export type RealtimeEventType =
  | 'DISPATCH_STARTED'
  | 'BOOKING_OFFERED'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_EXPIRED'
  | 'DISPATCH_FAILED'
  | 'PROVIDER_ASSIGNED'
  | 'JOB_STATUS_CHANGED'
  | 'PROVIDER_LOCATION_UPDATED'
  | 'PROVIDER_LOCATION_STALE'
  | 'PROVIDER_LOCATION_UNAVAILABLE'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'WALLET_CREDITED'
  | 'CANCELLATION_REQUESTED'
  | 'BOOKING_CANCELLED'
  | 'NO_SHOW_RECORDED'
  | 'REFUND_REQUESTED'
  | 'REFUND_PROCESSING'
  | 'REFUND_COMPLETED'
  | 'REFUND_FAILED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_UPDATED'
  | 'DISPUTE_RESOLVED'
  | 'QUOTE_REQUESTED'
  | 'QUOTE_SUBMITTED'
  | 'QUOTE_UPDATED'
  | 'QUOTE_WITHDRAWN'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_REJECTED'
  | 'MESSAGE_SENT'
  | 'CONVERSATION_READ'
  | 'SYSTEM_MESSAGE';

export interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  channel: string;
  payload: T;
  timestamp: string;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Publishes an event to a specific channel (e.g. 'provider:id', 'customer:id', 'booking:id')
   */
  public publish<T>(channel: string, type: RealtimeEventType, payload: T): void {
    const event: RealtimeEvent<T> = {
      type,
      channel,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit(channel, event);
    this.emitter.emit('*', event); // Global audit listener
  }

  /**
   * Subscribes a listener callback to a specific channel
   * Returns an unsubscribe cleanup function
   */
  public subscribe(channel: string, listener: (event: RealtimeEvent) => void): () => void {
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  /**
   * Convenience helpers for scoped channels
   */
  public emitToProvider<T>(providerId: string, type: RealtimeEventType, payload: T): void {
    this.publish(`provider:${providerId}`, type, payload);
  }

  public emitToCustomer<T>(customerId: string, type: RealtimeEventType, payload: T): void {
    this.publish(`customer:${customerId}`, type, payload);
  }

  public emitToBooking<T>(bookingId: string, type: RealtimeEventType, payload: T): void {
    this.publish(`booking:${bookingId}`, type, payload);
  }

  public publishToBooking<T>(
    bookingId: string,
    eventOrType: RealtimeEventType | { type: RealtimeEventType; payload: T },
    maybePayload?: T
  ): void {
    if (typeof eventOrType === 'object' && eventOrType !== null) {
      this.publish(`booking:${bookingId}`, eventOrType.type, eventOrType.payload);
    } else {
      this.publish(`booking:${bookingId}`, eventOrType as RealtimeEventType, maybePayload as T);
    }
  }
}

export const realtimeService = RealtimeService.getInstance();
