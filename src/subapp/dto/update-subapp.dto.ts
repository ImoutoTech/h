import { PartialType } from '@nestjs/mapped-types';
import { CreateSubappDto } from './create-subapp.dto';

export class UpdateSubappDto extends PartialType(CreateSubappDto) {}
