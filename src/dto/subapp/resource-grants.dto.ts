import { Type } from 'class-transformer';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import {
  RESOURCE_SCOPES,
  RESOURCE_SERVERS,
} from '@/module/oauth/resource-servers';
import { CreateSubAppDto } from './create-subapp.dto';

export class ResourceGrantDto {
  @IsString()
  @IsIn(Object.keys(RESOURCE_SERVERS))
  resource: string;

  @IsArray()
  @IsString({ each: true })
  @IsIn(RESOURCE_SCOPES, { each: true })
  scopes: string[];
}

export class SetResourceGrantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceGrantDto)
  grants: ResourceGrantDto[];
}

export class ProvisionConfidentialClientDto extends CreateSubAppDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceGrantDto)
  grants: ResourceGrantDto[];
}
