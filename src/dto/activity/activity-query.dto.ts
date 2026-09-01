import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
} from '@/module/activity/activity.types';

export class ActivityQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 20;

  @IsOptional()
  @IsIn(ACTIVITY_CATEGORIES)
  category?: ActivityCategory;
}
