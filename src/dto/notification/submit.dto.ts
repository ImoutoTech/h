import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class NotificationRecipientDto {
  @IsIn(['user', 'email'])
  kind: 'user' | 'email';

  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;
}

export class NotificationContentDto {
  @IsIn(['template', 'content'])
  kind: 'template' | 'content';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  templateKey?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

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
}

export class SubmitNotificationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => NotificationRecipientDto)
  recipients: NotificationRecipientDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationContentDto)
  content: NotificationContentDto;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  idempotencyKey?: string;
}
