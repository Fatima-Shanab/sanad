
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { session } from 'passport';




@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}


  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      message: 'Registration successful',
      user,
    };
  }

  private hashToken(token: string): string {
      return createHash('sha256').update(token).digest('hex');
    }

    private async signTokens(user: { id: number; role: string }, sid: string) {
    const [accessToken, refreshToken] = await Promise.all([
    this.jwtService.signAsync(
    { sub: user.id, role: user.role, sid,type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    ),
    this.jwtService.signAsync(
    { sub: user.id, sid ,type: 'refresh'},
    { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
    ),
    ]);
    return { accessToken, refreshToken };
    }

  async login(dto: LoginDto,userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

   const session = await this.prisma.session.create({
      data: {
      userId: user.id,
      userAgent,
      refreshTokenHash: '',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      });
    const tokens= await this.signTokens( user,session.id );

    await this.saveRefreshHash(session.id, tokens.refreshToken);

       return {
    
      tokens,
      session_id: session.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

  }

  private saveRefreshHash(sid:string , token: string) {
  return this.prisma.session.update({
  where: { id: sid },
  data: { refreshTokenHash: this.hashToken(token) },
  });
  }
  

    async refreshToken(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: {
        id: payload.sid,
      },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }
    if (session.refreshTokenHash !== this.hashToken(refreshToken)) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException();
    }
    const existUser=await this.prisma.user.findUnique({where:{id:payload.userId}});
    if(!existUser){
      throw new NotFoundException();
    }
      const [access_token, refresh_token] = await Promise.all([
        this.jwtService.signAsync(
          {
            sub: existUser.id,
            email: existUser.email,
            role: existUser.role,
            sid: session.id,
            type: 'access',
          },
          {
            expiresIn: '15m',
          },
        ),

        this.jwtService.signAsync(
          {
            sub: existUser.id,
            sid: session.id,
            type: 'refresh'
          },
          {
            expiresIn: '7d',
          },
        ),
      ]);
      const hashedRefreshToken = this.hashToken(refresh_token);
      await this.prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          refreshTokenHash: hashedRefreshToken,
        },
      });
      return { access_token, refresh_token };
  }


  async logout( sessionId: string ) {
    const result = await this.prisma.session.update({
      where: {
        id:sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { message: 'Logged out successfully' };
  }
}
