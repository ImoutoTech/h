import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  VERSION_NEUTRAL,
  Query,
  Request,
  DefaultValuePipe,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { SubAppService } from './subapp.service';
import { CreateSubAppDto, UpdateSubAppDto } from '@/dto';
import { AuthRoles } from '@/common/decorator';
import { UserJwtPayload } from '@/utils/types';

@Controller({
  path: 'app',
  version: [VERSION_NEUTRAL, '1'],
})
export class SubAppController {
  constructor(private readonly subappService: SubAppService) {}

  @Post('/reg')
  @AuthRoles('user')
  create(
    @Body() createSubAppDto: CreateSubAppDto,
    @Request() req: { user: UserJwtPayload },
  ) {
    return this.subappService.create(createSubAppDto, req.user.id);
  }

  @Get('/all')
  @AuthRoles('admin')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('size', new DefaultValuePipe(500), ParseIntPipe) size = 500,
    @Query('search') search = '',
  ) {
    return this.subappService.findAll(page, size, search);
  }

  @Get('/my')
  @AuthRoles('user')
  findMy(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('size', new DefaultValuePipe(500), ParseIntPipe) size = 500,
    @Query('search') search = '',
    @Request() req: { user: UserJwtPayload },
  ) {
    return this.subappService.findUserApp(req.user.id, page, size, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subappService.findOne(id);
  }

  @Post(':id')
  @AuthRoles('user')
  callback(@Param('id') id: string, @Request() req: { user: UserJwtPayload }) {
    return this.subappService.callback(id, req.user.id);
  }

  @Put(':id')
  @AuthRoles('user')
  update(
    @Param('id') id: string,
    @Body() updateSubappDto: UpdateSubAppDto,
    @Request() req: { user: UserJwtPayload },
  ) {
    return this.subappService.update(id, updateSubappDto, req.user.id);
  }

  @Delete(':id')
  @AuthRoles('user')
  remove(@Param('id') id: string, @Request() req: { user: UserJwtPayload }) {
    return this.subappService.remove(id, req.user.id);
  }
}
