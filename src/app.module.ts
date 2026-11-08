
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';

import { AuthModule } from './modules/auth/auth.module.js';
import { ProgramsModule } from './modules/programs/programs.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { AnnouncementsModule } from './modules/announcements/announcements.module.js';
import { MaterialsModule } from './modules/materials/materials.module.js';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';


@Module({
  imports: [
    ConfigModule.forRoot({  isGlobal: true,  }),
    PrismaModule,AuthModule,ProgramsModule,ApplicationsModule,SessionsModule,
    AnnouncementsModule,MaterialsModule,
   ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // 100 requests per minute per IP
   CacheModule.register({ isGlobal: true, ttl: 10_000 })
  ],
providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }], // applied to the whole API
})
export class AppModule {}
