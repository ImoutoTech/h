import { Inject, Injectable } from '@nestjs/common';
import type {
  ChannelAdapter,
  ChannelMessage,
  ChannelSendResult,
} from './notification.types';
import { CHANNEL_ADAPTERS } from './notification.types';

@Injectable()
export class ChannelAdapterRegistry {
  private readonly byType: Map<ChannelAdapter['channelType'], ChannelAdapter>;

  constructor(
    @Inject(CHANNEL_ADAPTERS)
    adapters: ChannelAdapter[],
  ) {
    this.byType = new Map(
      adapters.map((adapter) => [adapter.channelType, adapter]),
    );
  }

  resolve(channelType: 'email'): ChannelAdapter {
    const adapter = this.byType.get(channelType);
    if (adapter) return adapter;
    throw new Error(`No channel adapter registered for ${channelType}`);
  }
}

@Injectable()
export class TestChannelAdapter implements ChannelAdapter {
  readonly channelType = 'email' as const;
  readonly messages: ChannelMessage[] = [];
  results: ChannelSendResult[] = [];

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    this.messages.push(message);
    return this.results.shift() || { accepted: true };
  }
}
