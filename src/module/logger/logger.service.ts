import { LoggerService, Injectable } from '@nestjs/common';
import * as chalk from 'chalk';
import * as dayjs from 'dayjs';
import 'winston-daily-rotate-file';

import { createLogger, format, Logger, transports } from 'winston';
import { LOGGER_PREFIX } from '@/utils/constants';

export const HLOGGER_TOKEN = 'h_logger_service';

@Injectable()
export class HLogger implements LoggerService {
  private logger: Logger;

  constructor() {
    this.logger = createLogger({
      level: 'debug',
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ context, level, message, time }) => {
              const appStr = chalk.green(LOGGER_PREFIX);
              const contextStr = chalk.yellow(`[${context}]`);

              return `${appStr} ${time} ${level} ${contextStr} ${message} `;
            }),
          ),
        }),
        new transports.DailyRotateFile({
          level: 'info',
          dirname: 'log',
          filename: 'h-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '1k',
        }),
      ],
    });
  }

  public log(text: string, context?: string) {
    const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
    this.logger.log('info', text, { context, time });
  }

  public warn(text: string, context?: string) {
    const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
    this.logger.log('warn', text, { context, time });
  }

  public error(text: string, context?: string) {
    const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
    this.logger.log('error', text, { context, time });
  }
}
