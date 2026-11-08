
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Throttle } from '@nestjs/throttler';


type AuthenticatedRequest = ExpressRequest & {
  user: {
    userId: number;
    email: string;
    role: string;
    sessionId: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 attempts per minute
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

@Post('logout')
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.OK)
logout(@Request() req: AuthenticatedRequest) {
  return this.authService.logout(req.user.sessionId); // تمرير الـ string مباشرة
}

@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@CurrentUser() user: {
  userId: number;
  email: string;
  role: string;
}) {
  return user;
}

@Get('admin-check')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
adminCheck() {
  return {
    message: 'Welcome, Admin!',
  };

}
}
