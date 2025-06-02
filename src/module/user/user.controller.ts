import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  VERSION_NEUTRAL,
  Put,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
} from '@nestjs/common';
import { Md5 } from 'ts-md5';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginUserDto,
  UpdatePasswordDto,
} from '@/dto';
import { AuthRoles, PermissionGuard, UserParams } from '@reus-able/nestjs';
import { type UserJwtPayload } from '@reus-able/types';

@Controller({
  path: 'user',
  version: [VERSION_NEUTRAL, '1'],
})
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/register')
  @AuthRoles()
  create(@Body() createUserDto: CreateUserDto, @Query('md5') md5: boolean) {
    const regData = { ...createUserDto };

    if (!md5) {
      regData.password = Md5.hashStr(regData.password);
    }
    return this.userService.create(regData);
  }

  @Post('/login')
  @AuthRoles()
  @HttpCode(200)
  login(@Body() loginUserDto: LoginUserDto, @Query('md5') md5: boolean) {
    const loginData = { ...loginUserDto };

    if (!md5) {
      loginData.password = Md5.hashStr(loginData.password);
    }

    return this.userService.login(loginData);
  }

  @Get('/refresh')
  @AuthRoles('refresh')
  refresh(@UserParams() user: UserJwtPayload) {
    return this.userService.refresh(user);
  }

  @Get('/validate')
  @AuthRoles('user')
  validate(@UserParams() user: UserJwtPayload) {
    return user;
  }

  @Get('/all')
  @PermissionGuard('bJqZjnMW')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('size', new DefaultValuePipe(500), ParseIntPipe) size = 500,
    @Query('search') search = '',
  ) {
    return this.userService.findAll(page, size, search);
  }

  @Get('/permission')
  @AuthRoles('user')
  getUserPermission(@UserParams() user: UserJwtPayload) {
    return this.userService.getUserPermission(user.id);
  }

  @Get(':id')
  @PermissionGuard('pedimtLB')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Put(':id')
  @PermissionGuard('gnhNAwmj')
  update(
    @UserParams() user: UserJwtPayload,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(user.id, updateUserDto);
  }

  @Put(':id/password')
  @PermissionGuard('gnhNAwmj')
  updatePassword(
    @UserParams() user: UserJwtPayload,
    @Body() updateData: UpdatePasswordDto,
    @Query('md5') md5: boolean,
  ) {
    const newData = { ...updateData };

    if (!md5) {
      newData.newVal = Md5.hashStr(updateData.newVal);
      newData.oldVal = Md5.hashStr(updateData.oldVal);
    }

    return this.userService.updatePassword(user.id, updateData);
  }
}
