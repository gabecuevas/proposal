export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type MailSendResult = {
  accepted: boolean;
  providerMessageId?: string;
  error?: string;
};

export interface MailAdapter {
  send(message: MailMessage): Promise<MailSendResult>;
}

const sentLog: MailMessage[] = [];

/** In-memory capture for tests and local development without a provider. */
export class ConsoleMailAdapter implements MailAdapter {
  async send(message: MailMessage): Promise<MailSendResult> {
    sentLog.push(message);
    if (process.env.NODE_ENV !== "test") {
      console.info("[mail:console]", {
        to: message.to,
        subject: message.subject,
        textPreview: message.text.slice(0, 200),
      });
    }
    return { accepted: true, providerMessageId: `console-${Date.now()}` };
  }
}

export function getCapturedMails(): MailMessage[] {
  return [...sentLog];
}

export function clearCapturedMails() {
  sentLog.length = 0;
}

class ResendMailAdapter implements MailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        accepted: false,
        error: `Resend ${response.status}: ${body.slice(0, 200)}`,
      };
    }
    const json = (await response.json().catch(() => null)) as { id?: string } | null;
    return { accepted: true, providerMessageId: json?.id };
  }
}

let cached: MailAdapter | null = null;

export function getMailAdapter(): MailAdapter {
  if (cached) {
    return cached;
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM_ADDRESS;
  if (apiKey && from) {
    cached = new ResendMailAdapter(apiKey, from);
  } else {
    cached = new ConsoleMailAdapter();
  }
  return cached;
}

export function resetMailAdapterForTests() {
  cached = null;
}
