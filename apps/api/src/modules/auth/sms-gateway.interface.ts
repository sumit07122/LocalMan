import { env } from '../../config/env.js';

export interface SendSmsOptions {
  toPhoneNumber: string;
  message: string;
  otpCode?: string;
}

export interface SmsGateway {
  sendOtp(options: SendSmsOptions): Promise<{ success: boolean; messageId?: string }>;
}

export class MockSmsGateway implements SmsGateway {
  async sendOtp(options: SendSmsOptions): Promise<{ success: boolean; messageId: string }> {
    const timestamp = new Date().toLocaleTimeString();
    console.log('\n======================================================');
    console.log(`📱 [MOCK SMS GATEWAY] ${timestamp}`);
    console.log(`To: ${options.toPhoneNumber}`);
    console.log(`Message: ${options.message}`);
    if (options.otpCode) {
      console.log(`🔑 OTP CODE: >>> ${options.otpCode} <<<`);
    }
    console.log('======================================================\n');

    return {
      success: true,
      messageId: `mock_sms_${Date.now()}`,
    };
  }
}

export function getSmsGateway(): SmsGateway {
  switch (env.SMS_GATEWAY_PROVIDER) {
    case 'mock':
    default:
      return new MockSmsGateway();
  }
}
