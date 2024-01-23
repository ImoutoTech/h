import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  VERSION_NEUTRAL,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { SubAppService } from './subapp.service';
import { CreateSubappDto } from './dto/create-subapp.dto';
import { UpdateSubappDto } from './dto/update-subapp.dto';
import { AdminGuard } from '@/common/guard';

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
  @UseGuards(AdminGuard)
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('size', new DefaultValuePipe(500), ParseIntPipe) size = 500,
    @Query('search') search = '',
  ) {
    return this.subappService.findAll(page, size, search);
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
