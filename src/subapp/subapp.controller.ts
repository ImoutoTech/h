import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { SubAppService } from './subapp.service';
import { CreateSubappDto } from './dto/create-subapp.dto';
import { UpdateSubappDto } from './dto/update-subapp.dto';

@Controller({
  path: 'app',
  version: [VERSION_NEUTRAL, '1'],
})
export class SubAppController {
  constructor(private readonly subappService: SubAppService) {}

  @Post()
  create(@Body() createSubappDto: CreateSubappDto) {
    return this.subappService.create(createSubappDto);
  }

  @Get('/all')
  findAll() {
    return this.subappService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subappService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSubappDto: UpdateSubappDto) {
    return this.subappService.update(+id, updateSubappDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subappService.remove(+id);
  }
}
