import { PartialType } from '@nestjs/mapped-types';
import { CreateSubAppDto } from './create-subapp.dto';
import { AppStatus } from '@/entity/SubAppMeta';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateSubAppDto extends PartialType(CreateSubAppDto) {
  @IsEnum(AppStatus)
  @IsOptional()
  status?: AppStatus;
}
