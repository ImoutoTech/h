import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { NotificationApiKeyService } from './api-key.service';
import { notificationError } from './notification-error';

@Injectable()
export class NotificationKeyGuard implements CanActivate {
  constructor(private readonly keys: NotificationApiKeyService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = String(request.headers.authorization || '');
    const match = /^NotificationKey\s+(.+)$/.exec(authorization);
    if (!match) notificationError('notification_invalid_key');
    request.notificationCaller = await this.keys.authenticate(match[1]);
    return true;
  }
}
