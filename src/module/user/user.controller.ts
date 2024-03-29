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
} from '@nestjs/common';
import { Md5 } from 'ts-md5';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginUserDto,
  UpdatePasswordDto,
} from '@/dto';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
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
  @AuthRoles('admin')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('size', new DefaultValuePipe(500), ParseIntPipe) size = 500,
    @Query('search') search = '',
  ) {
    return this.userService.findAll(page, size, search);
  }

  @Get(':id')
  @AuthRoles('user')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Put(':id')
  @AuthRoles('user')
  update(
    @UserParams() user: UserJwtPayload,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(user.id, updateUserDto);
  }

  @Put(':id/password')
  @AuthRoles('user')
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
