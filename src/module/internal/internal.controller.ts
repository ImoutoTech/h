import { Controller, Get, Param, ParseIntPipe, Req, Res } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ContactTokenError,
  ContactTokenService,
} from './contact-token.service';
import { NotificationContactService } from './notification-contact.service';

@Controller('internal/v1/users')
export class InternalController {
  constructor(
    private readonly tokens: ContactTokenService,
    private readonly contacts: NotificationContactService,
  ) {}

  @Get(':id/notification-contacts/email')
  async email(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res() res: any,
  ) {
    const traceId = this.traceId(req.headers['x-request-id']);
    res.header('x-request-id', traceId);
    let clientId: string;
    try {
      ({ clientId } = this.tokens.verify(req.headers.authorization));
    } catch (reason) {
      if (!(reason instanceof ContactTokenError)) throw reason;
      const status = reason.reason === 'unauthorized' ? 401 : 403;
      return res
        .status(status)
        .send({ error: `notification_contact_${reason.reason}` });
    }
    const contact = await this.contacts.email(id, clientId, traceId);
    if (!contact)
      return res
        .status(404)
        .send({ error: 'notification_contact_unavailable' });
    return res.send(contact);
  }

  private traceId(value: unknown) {
    return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
      ? value
      : randomUUID();
  }
}
