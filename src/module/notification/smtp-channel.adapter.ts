import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ChannelConfigService } from './channel-config.service';
import type {
  ChannelAdapter,
  ChannelMessage,
  ChannelSendResult,
} from './notification.types';

type SmtpError = Error & { responseCode?: number; code?: string };

@Injectable()
export class SmtpChannelAdapter implements ChannelAdapter {
  readonly channelType = 'email' as const;

  constructor(private readonly configs: ChannelConfigService) {}

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    const config = await this.configs.credentials();
    if (!config) {
      return {
        accepted: false,
        retryable: true,
        errorClass: 'channel_unavailable',
      };
    }
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.tlsMode === 'tls',
      requireTLS: config.tlsMode === 'starttls',
      ignoreTLS: config.tlsMode === 'none',
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 120_000,
      auth: { user: config.username, pass: config.password },
    });
    try {
      await transport.sendMail({
        from: config.fromName
          ? { name: config.fromName, address: config.fromAddress }
          : config.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { accepted: true };
    } catch (reason) {
      return this.classify(reason as SmtpError);
    } finally {
      transport.close();
    }
  }

  classify(reason: SmtpError): ChannelSendResult {
    const code = reason.code || '';
    const responseCode = reason.responseCode || 0;
    if (responseCode >= 500 && responseCode < 600) {
      return {
        accepted: false,
        retryable: false,
        errorClass:
          responseCode === 550 ? 'recipient_rejected' : 'smtp_permanent',
      };
    }
    if (
      responseCode >= 400 ||
      ['ECONNECTION', 'ETIMEDOUT', 'ECONNRESET', 'EDNS'].includes(code)
    ) {
      return { accepted: false, retryable: true, errorClass: 'smtp_transient' };
    }
    return { accepted: false, retryable: true, errorClass: 'smtp_unknown' };
  }
}
