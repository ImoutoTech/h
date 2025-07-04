import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  VERSION_NEUTRAL,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { SubAppService } from './subapp.service';
import { CreateSubAppDto, UpdateSubAppDto } from '@/dto';
import { AuthRoles, UserParams, PermissionGuard } from '@reus-able/nestjs';
import { UserJwtPayload } from '@reus-able/types';

@Controller({
  path: 'app',
  version: [VERSION_NEUTRAL, '1'],
})
export class SubAppController {
  constructor(private readonly subappService: SubAppService) {}

  @Post('/reg')
  @PermissionGuard('mwGSuMXj')
  create(
    @Body() createSubAppDto: CreateSubAppDto,
    @UserParams() user: UserJwtPayload,
  ) {
    return this.subappService.create(createSubAppDto, user.id);
  }

  @Get('/all')
  @PermissionGuard('hZLbqmHh')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('size', new DefaultValuePipe(500), ParseIntPipe) size = 500,
    @Query('search') search = '',
  ) {
    return this.subappService.findAll(page, size, search);
  }

  @Get('/my')
  @PermissionGuard('PeqSazMt')
  findMy(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('size', new DefaultValuePipe(500), ParseIntPipe) size = 500,
    @Query('search') search = '',
    @UserParams() user: UserJwtPayload,
  ) {
    return this.subappService.findUserApp(user.id, page, size, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subappService.findOne(id);
  }

  @Post(':id')
  @AuthRoles('user')
  callback(@Param('id') id: string, @UserParams() user: UserJwtPayload) {
    return this.subappService.callback(id, user.id);
  }

  @Put(':id')
  @PermissionGuard('QffBvVPP')
  update(
    @Param('id') id: string,
    @Body() updateSubappDto: UpdateSubAppDto,
    @UserParams() user: UserJwtPayload,
  ) {
    return this.subappService.update(id, updateSubappDto, user.id);
  }

  @Delete(':id')
  @PermissionGuard('qtNiAVBF')
  remove(@Param('id') id: string, @UserParams() user: UserJwtPayload) {
    return this.subappService.remove(id, user.id);
  }

  @Post(':id/secret')
  @PermissionGuard('QffBvVPP')
  createSecret(@Param('id') id: string, @UserParams() user: UserJwtPayload) {
    return this.subappService.createAppSecret(id, user.id);
  }

  @Get(':id/secret')
  @PermissionGuard('PeqSazMt')
  getSecret(@Param('id') id: string, @UserParams() user: UserJwtPayload) {
    return this.subappService.getAppSecret(id, user.id);
  }

  @Put(':id/secret/:sid')
  @PermissionGuard('QffBvVPP')
  setSecret(
    @Param('id') app: string,
    @Param('sid') id: string,
    @UserParams() user: UserJwtPayload,
  ) {
    return this.subappService.setAppSecret(app, +id, user.id);
  }

  @Delete(':id/secret/:sid')
  @PermissionGuard('QffBvVPP')
  delSecret(
    @Param('id') app: string,
    @Param('sid') id: string,
    @UserParams() user: UserJwtPayload,
  ) {
    return this.subappService.delAppSecret(app, +id, user.id);
  }
}
