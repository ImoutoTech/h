import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { EmailVerificationPurpose } from '@/entity/email-verification-purpose';

export class CreateEmailVerificationChallengeDto {
  @IsEnum(EmailVerificationPurpose)
  purpose: EmailVerificationPurpose;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class VerifyEmailVerificationChallengeDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}

export class ChangeEmailDto {
  @IsEmail()
  email: string;

  @IsUUID()
  verificationProof: string;
}
