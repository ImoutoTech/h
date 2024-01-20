import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  VERSION_NEUTRAL,
  Put,
  Query,
} from '@nestjs/common';
import { Md5 } from 'ts-md5';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, LoginUserDto } from './dto';

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

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }
}
