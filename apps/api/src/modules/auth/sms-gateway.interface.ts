import { env } from '../../config/env.js';

export interface SendSmsOptions {
  toPhoneNumber: string;
  message: string;
  otpCode?: string;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsGateway {
  readonly providerName: string;
  sendOtp(options: SendSmsOptions): Promise<SmsSendResult>;
}

/**
 * Deterministic Mock SMS Gateway for Local Development and CI Testing.
 * Masks OTP in non-development environments to prevent log leaks.
 */
export class MockSmsGateway implements SmsGateway {
  public readonly providerName = 'mock';
  public lastDispatchedMessage?: { to: string; message: string; otp?: string; timestamp: number };

  async sendOtp(options: SendSmsOptions): Promise<SmsSendResult> {
    const timestamp = new Date().toLocaleTimeString();
    const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
    const displayOtp = options.otpCode
      ? isDev
        ? options.otpCode
        : `${options.otpCode.slice(0, 2)}****`
      : undefined;

    console.log('\n======================================================');
    console.log(`📱 [MOCK SMS GATEWAY] ${timestamp}`);
    console.log(`To: ${options.toPhoneNumber}`);
    console.log(`Message: ${options.message}`);
    if (displayOtp) {
      console.log(`🔑 OTP CODE: >>> ${displayOtp} <<<`);
    }
    console.log('======================================================\n');

    this.lastDispatchedMessage = {
      to: options.toPhoneNumber,
      message: options.message,
      otp: options.otpCode,
      timestamp: Date.now(),
    };

    return {
      success: true,
      messageId: `mock_sms_${Date.now()}`,
    };
  }
}

/**
 * Fast2SMS Gateway (India DLT & Quick SMS API)
 * https://www.fast2sms.com/dev/bulkV2
 */
export class Fast2SmsGateway implements SmsGateway {
  public readonly providerName = 'fast2sms';
  private apiKey: string;
  private senderId: string;
  private fetchFn: typeof fetch;

  constructor(apiKey?: string, senderId?: string, fetchFn?: typeof fetch) {
    this.apiKey = apiKey ?? env.SMS_GATEWAY_API_KEY;
    this.senderId = senderId ?? env.SMS_SENDER_ID;
    this.fetchFn = fetchFn ?? fetch;
  }

  async sendOtp(options: SendSmsOptions): Promise<SmsSendResult> {
    if (!this.apiKey || this.apiKey === 'mock_key') {
      console.warn('[Fast2SMS] Missing valid SMS_GATEWAY_API_KEY. Cannot dispatch live SMS.');
      return { success: false, error: 'FAST2SMS_API_KEY_UNCONFIGURED' };
    }

    // Clean Indian 10-digit number
    const cleanNumber = options.toPhoneNumber.replace(/^\+91/, '').replace(/\D/g, '');
    if (cleanNumber.length !== 10) {
      return { success: false, error: 'INVALID_INDIAN_PHONE_NUMBER' };
    }

    try {
      const payload = options.otpCode
        ? {
            route: 'otp',
            variables_values: options.otpCode,
            numbers: cleanNumber,
            sender_id: this.senderId,
          }
        : {
            route: 'q',
            message: options.message,
            language: 'english',
            flash: 0,
            numbers: cleanNumber,
            sender_id: this.senderId,
          };

      const response = await this.fetchFn('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      const data = (await response.json()) as any;
      if (response.ok && data.return === true) {
        return {
          success: true,
          messageId: data.request_id || `f2s_${Date.now()}`,
        };
      }

      console.error('[Fast2SMS] Dispatch failed:', data.message || response.statusText);
      return {
        success: false,
        error: data.message || `HTTP_${response.status}`,
      };
    } catch (err: any) {
      console.error('[Fast2SMS] Request exception:', err.message);
      return { success: false, error: err.message };
    }
  }
}

/**
 * MSG91 Gateway (India Enterprise SMS / OTP)
 * https://control.msg91.com/api/v5/otp
 */
export class Msg91Gateway implements SmsGateway {
  public readonly providerName = 'msg91';
  private authKey: string;
  private templateId: string;
  private fetchFn: typeof fetch;

  constructor(authKey?: string, templateId?: string, fetchFn?: typeof fetch) {
    this.authKey = authKey ?? env.SMS_GATEWAY_API_KEY;
    this.templateId = templateId ?? env.MSG91_TEMPLATE_ID ?? '';
    this.fetchFn = fetchFn ?? fetch;
  }

  async sendOtp(options: SendSmsOptions): Promise<SmsSendResult> {
    if (!this.authKey || this.authKey === 'mock_key') {
      console.warn('[MSG91] Missing valid authkey. Cannot dispatch live SMS.');
      return { success: false, error: 'MSG91_AUTHKEY_UNCONFIGURED' };
    }

    const cleanNumber = options.toPhoneNumber.replace(/^\+/, '').replace(/\D/g, '');

    try {
      const url = new URL('https://control.msg91.com/api/v5/otp');
      url.searchParams.append('authkey', this.authKey);
      url.searchParams.append('mobile', cleanNumber);
      if (this.templateId) {
        url.searchParams.append('template_id', this.templateId);
      }
      if (options.otpCode) {
        url.searchParams.append('otp', options.otpCode);
      }

      const response = await this.fetchFn(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      const data = (await response.json()) as any;
      if (response.ok && (data.type === 'success' || data.message === 'OTP sent successfully')) {
        return {
          success: true,
          messageId: data.request_id || `msg91_${Date.now()}`,
        };
      }

      console.error('[MSG91] Dispatch failed:', data.message || response.statusText);
      return {
        success: false,
        error: data.message || `HTTP_${response.status}`,
      };
    } catch (err: any) {
      console.error('[MSG91] Request exception:', err.message);
      return { success: false, error: err.message };
    }
  }
}

/**
 * Twilio SMS Gateway (Global & International SMS)
 * https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 */
export class TwilioGateway implements SmsGateway {
  public readonly providerName = 'twilio';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private fetchFn: typeof fetch;

  constructor(
    accountSid?: string,
    authToken?: string,
    fromNumber?: string,
    fetchFn?: typeof fetch
  ) {
    this.accountSid = accountSid ?? env.TWILIO_ACCOUNT_SID ?? '';
    this.authToken = authToken ?? env.TWILIO_AUTH_TOKEN ?? '';
    this.fromNumber = fromNumber ?? env.TWILIO_FROM_NUMBER ?? '';
    this.fetchFn = fetchFn ?? fetch;
  }

  async sendOtp(options: SendSmsOptions): Promise<SmsSendResult> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.warn('[Twilio] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER.');
      return { success: false, error: 'TWILIO_CREDENTIALS_UNCONFIGURED' };
    }

    try {
      const basicAuth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const bodyParams = new URLSearchParams({
        To: options.toPhoneNumber,
        From: this.fromNumber,
        Body: options.message,
      });

      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        this.accountSid
      )}/Messages.json`;

      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
        signal: AbortSignal.timeout(8000),
      });

      const data = (await response.json()) as any;
      if (response.ok && data.sid) {
        return {
          success: true,
          messageId: data.sid,
        };
      }

      console.error('[Twilio] Dispatch failed:', data.message || response.statusText);
      return {
        success: false,
        error: data.message || `HTTP_${response.status}`,
      };
    } catch (err: any) {
      console.error('[Twilio] Request exception:', err.message);
      return { success: false, error: err.message };
    }
  }
}

let activeGateway: SmsGateway | null = null;

export function getSmsGateway(): SmsGateway {
  if (activeGateway) {
    return activeGateway;
  }

  switch (env.SMS_GATEWAY_PROVIDER) {
    case 'fast2sms':
      return new Fast2SmsGateway();
    case 'msg91':
      return new Msg91Gateway();
    case 'twilio':
      return new TwilioGateway();
    case 'mock':
    default:
      return new MockSmsGateway();
  }
}

export function setSmsGatewayForTest(gateway: SmsGateway | null): void {
  activeGateway = gateway;
}
