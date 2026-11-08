
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { AuthController } from './auth.controller.js';


@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService,JwtStrategy,JwtAuthGuard,RolesGuard],
  exports: [AuthService],
})
export class AuthModule {}
