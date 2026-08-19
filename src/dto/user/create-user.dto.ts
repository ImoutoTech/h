import { IsNotEmpty, IsEmail, IsUUID } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  nickname: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsUUID()
  verificationProof: string;
}
