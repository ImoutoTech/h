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
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Md5 } from 'ts-md5';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginUserDto,
  UpdatePasswordDto,
  ChangeEmailDto,
  CreateEmailVerificationChallengeDto,
  VerifyEmailVerificationChallengeDto,
} from '@/dto';
import {
  AuthRoles,
  BusinessException,
  PermissionGuard,
  UserParams,
} from '@reus-able/nestjs';
import { type UserJwtPayload } from '@reus-able/types';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationPurpose } from '@/entity';

@Controller({
  path: 'user',
  version: [VERSION_NEUTRAL, '1'],
})
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly emailVerification: EmailVerificationService,
    private readonly config: ConfigService,
  ) {}

  private authenticatedUser(request: FastifyRequest) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer '))
      throw new BusinessException('请先登录');
    try {
      const user = jwt.verify(
        authorization.slice(7),
        this.config.get<string>('TOKEN_SECRET', ''),
      ) as UserJwtPayload & { refresh?: boolean };
      if (user.refresh) throw new Error('refresh token');
      return user;
    } catch {
      throw new BusinessException('登录状态无效');
    }
  }

  @Post('/email-verification/challenges')
  @AuthRoles()
  createEmailChallenge(
    @Body() input: CreateEmailVerificationChallengeDto,
    @Req() request: FastifyRequest,
  ) {
    const userId =
      input.purpose === EmailVerificationPurpose.REGISTER
        ? undefined
        : this.authenticatedUser(request).id;
    return this.emailVerification.create(input, userId, request.ip);
  }

  @Post('/email-verification/challenges/:id/verify')
  @AuthRoles()
  @HttpCode(200)
  verifyEmailChallenge(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: VerifyEmailVerificationChallengeDto,
    @Req() request: FastifyRequest,
  ) {
    const authorization = request.headers.authorization;
    const userId = authorization
      ? this.authenticatedUser(request).id
      : undefined;
    return this.emailVerification.verify(id, input.code, userId, request.ip);
  }

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
      if (updateData.oldVal) newData.oldVal = Md5.hashStr(updateData.oldVal);
    }

    return this.userService.updatePassword(user.id, newData);
  }

  @Put(':id/email')
  @PermissionGuard('gnhNAwmj')
  changeEmail(
    @UserParams() user: UserJwtPayload,
    @Body() input: ChangeEmailDto,
  ) {
    return this.userService.changeEmail(user.id, input);
  }
}
