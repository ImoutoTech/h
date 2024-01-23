import { IsNotEmpty } from 'class-validator';

export class CreateSubAppDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  callback: string;

  description: string;
}
