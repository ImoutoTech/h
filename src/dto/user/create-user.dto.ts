import { IsNotEmpty, IsEmail, IsUUID, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  nickname: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  password: string;

  @IsUUID()
  emailVerificationChallengeId: string;
}
