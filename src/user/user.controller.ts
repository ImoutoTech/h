import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  VERSION_NEUTRAL,
  Put,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Md5 } from 'ts-md5';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginUserDto,
  UpdatePasswordDto,
} from './dto';
import { AdminGuard, LoginGuard, RefreshGuard } from '@/common/guard';
import type { UserJwtPayload } from '@/utils/types';

@Controller({
  path: 'user',
  version: [VERSION_NEUTRAL, '1'],
})
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/register')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Post('/login')
  login(@Body() loginUserDto: LoginUserDto, @Query('md5') md5: boolean) {
    const loginData = { ...loginUserDto };

    if (!md5) {
      loginData.password = Md5.hashStr(loginData.password);
    }

    return this.userService.login(loginData);
  }

  @Get('/refresh')
  @UseGuards(RefreshGuard)
  refresh(@Request() req: { user: UserJwtPayload }) {
    return this.userService.refresh(req.user);
  }

  @Get('/validate')
  @UseGuards(LoginGuard)
  validate(@Request() req: { user: UserJwtPayload }) {
    return req.user;
  }

  @Get('/all')
  @UseGuards(AdminGuard)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(LoginGuard)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Put(':id')
  @UseGuards(LoginGuard)
  update(
    @Request() req: { user: UserJwtPayload },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(req.user.id, updateUserDto);
  }

  @Put(':id/password')
  @UseGuards(LoginGuard)
  updatePassword(
    @Request() req: { user: UserJwtPayload },
    @Body() updateData: UpdatePasswordDto,
    @Query('md5') md5: boolean,
  ) {
    const newData = { ...updateData };

    if (!md5) {
      newData.newVal = Md5.hashStr(updateData.newVal);
      newData.oldVal = Md5.hashStr(updateData.oldVal);
    }

    return this.userService.updatePassword(req.user.id, updateData);
  }
}
