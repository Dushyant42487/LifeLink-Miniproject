/**
 * LifeLink SMS Notification Client Service
 *
 * Dispatches confirmation SMS notifications to donors via the LifeLink sms-service
 * microservice (POST http://localhost:7001/send-sms).
 *
 * Failures in SMS delivery are logged gracefully and do not block primary HTTP request execution.
 */

interface SendSmsOptions {
  phoneNumber?: string | null;
  message: string;
}

interface SmsResponse {
  success: boolean;
  data?: any;
  error?: string;
  skipped?: boolean;
}

export class SmsService {
  private static serviceUrl = process.env.SMS_SERVICE_URL || 'http://localhost:7001/send-sms';

  /**
   * Send an SMS to a recipient phone number via sms-service
   */
  public static async sendSms(options: SendSmsOptions): Promise<SmsResponse> {
    const rawPhone = options.phoneNumber?.trim();

    if (!rawPhone) {
      console.log('[SMS-Service] Skipped sending SMS: no recipient phone number provided.');
      return { success: false, skipped: true, error: 'Recipient phone number is missing' };
    }

    try {
      const payload = JSON.stringify({
        phoneNumber: rawPhone,
        message: options.message
      });

      // Using global fetch (Node 18+)
      const response = await fetch(this.serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.warn(`[SMS-Service] SMS delivery failed (${response.status}) to ${rawPhone}:`, data);
        return { success: false, error: data?.error || `HTTP ${response.status}`, data };
      }

      console.log(`[SMS-Service] SMS sent successfully to ${rawPhone}.`);
      return { success: true, data };
    } catch (err: any) {
      // Fire-and-forget resiliency: Don't crash main medical workflow if SMS microservice is offline
      console.warn(`[SMS-Service] Could not reach SMS microservice at ${this.serviceUrl}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Helper: Send confirmation to donor from a Blood Bank
   */
  public static async sendBloodBankConfirmation(
    donorPhone: string | undefined | null,
    donorName: string,
    bankName: string,
    actionDetail: string
  ): Promise<SmsResponse> {
    const message = `Hello ${donorName}, this is a confirmation from ${bankName}: ${actionDetail}. Thank you for supporting LifeLink!`;
    return this.sendSms({ phoneNumber: donorPhone, message });
  }

  /**
   * Helper: Send confirmation to donor from a Hospital
   */
  public static async sendHospitalConfirmation(
    donorPhone: string | undefined | null,
    donorName: string,
    hospitalName: string,
    actionDetail: string
  ): Promise<SmsResponse> {
    const message = `Hello ${donorName}, this is a confirmation from ${hospitalName}: ${actionDetail}. Thank you for being a LifeLink blood donor!`;
    return this.sendSms({ phoneNumber: donorPhone, message });
  }
}

export const smsService = SmsService;
