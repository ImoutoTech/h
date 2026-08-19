import { IsOptional, IsString, IsUUID } from 'class-validator';
export class UpdatePasswordDto {
  @IsOptional()
  @IsString()
  oldVal?: string;

  @IsString()
  newVal: string;

  @IsUUID()
  verificationProof: string;
}
