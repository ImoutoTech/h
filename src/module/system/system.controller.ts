import { Controller, Get, Query } from '@nestjs/common';
import { SystemService } from './system.service';
import { VERSION_NEUTRAL } from '@nestjs/common';
import { AuthRoles } from '@reus-able/nestjs';
@Controller({
  path: 'system',
  version: [VERSION_NEUTRAL, '1'],
})
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('init')
  @AuthRoles('admin')
  async init(@Query('force') force = false) {
    return this.systemService.init(force);
  }
}
