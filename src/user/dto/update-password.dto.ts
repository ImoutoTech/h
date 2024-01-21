import { IsString } from 'class-validator';
export class UpdatePasswordDto {
  @IsString()
  oldVal: string;

  @IsString()
  newVal: string;
}
