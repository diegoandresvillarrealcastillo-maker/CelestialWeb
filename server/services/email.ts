import type { AppEnv } from '../config/env.js';

export type EmailMessage = { to: string; subject: string; text: string };
export interface EmailSender { send(message: EmailMessage): Promise<void> }

export class WebhookEmailSender implements EmailSender {
  constructor(private env: AppEnv) {}

  async send(message: EmailMessage) {
    if (!this.env.EMAIL_PROVIDER_URL || !this.env.EMAIL_PROVIDER_API_KEY || !this.env.EMAIL_FROM) return;

    const response = await fetch(this.env.EMAIL_PROVIDER_URL, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.env.EMAIL_PROVIDER_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: this.env.EMAIL_FROM, ...message }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Email provider rejected request with status ${response.status}`);
  }
}
