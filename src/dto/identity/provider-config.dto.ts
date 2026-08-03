import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProviderConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  clientSecret?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ExternalCallbackDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsString()
  error?: string;
}

export const PROVIDERS = ['github', 'google'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export class ProviderParamDto {
  @IsIn(PROVIDERS)
  provider: ProviderName;
}
