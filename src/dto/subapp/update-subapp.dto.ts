import { PartialType } from '@nestjs/mapped-types';
import { CreateSubAppDto } from './create-subapp.dto';

export class UpdateSubAppDto extends PartialType(CreateSubAppDto) {}
