import { IsEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsEmpty({ message: '请通过邮箱验证流程修改邮箱' })
  email?: never;

  @IsOptional()
  @IsString()
  avatar?: string;
}
