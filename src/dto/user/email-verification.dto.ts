import {
  IsEmail,
  IsNotEmpty,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class RequestEmailVerificationDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class VerifyEmailVerificationDto {
  @IsNotEmpty()
  @Matches(/^\d{6}$/u)
  code: string;
}

export class ChangeEmailDto {
  @IsUUID()
  challengeId: string;
}
