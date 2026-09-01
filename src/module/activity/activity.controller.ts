import { Controller, Get, Query } from '@nestjs/common';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { ActivityQueryDto } from '@/dto';
import { ActivityQueryService } from './activity-query.service';

@Controller('user/me')
export class ActivityController {
  constructor(private readonly queryService: ActivityQueryService) {}

  @Get('overview')
  @AuthRoles('user')
  overview(@UserParams() user: UserJwtPayload) {
    return this.queryService.overview(user);
  }

  @Get('activity')
  @AuthRoles('user')
  activity(
    @UserParams() user: UserJwtPayload,
    @Query() query: ActivityQueryDto,
  ) {
    return this.queryService.activity(user.id, query);
  }
}
