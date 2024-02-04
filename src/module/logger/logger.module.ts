import { Global, Module } from '@nestjs/common';
import { HLogger, HLOGGER_TOKEN } from './logger.service';

@Global()
@Module({
  providers: [
    {
      provide: HLOGGER_TOKEN,
      useClass: HLogger,
    },
  ],
  exports: [HLOGGER_TOKEN],
})
export class LoggerModule {}
