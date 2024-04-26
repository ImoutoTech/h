import { IsOptional, IsString } from 'class-validator';

export class OauthAuthorizeDto {
  @IsString()
  client_id: string;

  @IsString()
  redirect_uri: string;

  @IsString()
  @IsOptional()
  state: string;
}
