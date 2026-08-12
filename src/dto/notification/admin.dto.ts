import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { NotificationTlsMode } from '@/entity';

export class UpdateNotificationChannelDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsIn(['none', 'starttls', 'tls'])
  tlsMode?: NotificationTlsMode;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  fromName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  fromAddress?: string;
}

export class CreateNotificationTemplateDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
  @MaxLength(100)
  key: string;

  @IsString()
  @MinLength(1)
  @MaxLength(191)
  name: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @MaxLength(255)
  subject: string;

  @IsString()
  @MaxLength(102400)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(204800)
  html?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[A-Za-z_][A-Za-z0-9_]*$/, { each: true })
  allowedVariables: string[];
}

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(102400)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(204800)
  html?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[A-Za-z_][A-Za-z0-9_]*$/, { each: true })
  allowedVariables?: string[];
}

export class SetEnabledDto {
  @IsBoolean()
  enabled: boolean;
}

export class UpdateNotificationPolicyDto {
  @IsBoolean()
  directContent: boolean;

  @IsBoolean()
  manualRecipient: boolean;

  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  templateIds: string[];
}
