import { Logger, LoggerService, Injectable } from '@nestjs/common';

export const HLOGGER_TOKEN = 'h_logger_service';

@Injectable()
export class HLogger implements LoggerService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  public log(text: string, context?: string) {
    this.logger.log(text, context || '');
  }

  public warn(text: string, context?: string) {
    this.logger.warn(text, context || '');
  }

  public error(text: string, context?: string) {
    this.logger.error(text, context || '');
  }
}
