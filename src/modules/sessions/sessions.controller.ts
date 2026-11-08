
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { SessionsService } from './sessions.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';


type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
  ) {}

  // عرض جلسات برنامج منشور
  @Get('program/:programId')
  findByProgram(
    @Param('programId', ParseIntPipe) programId: number,
  ) {
    return this.sessionsService.findByProgram(programId);
  }

  // إنشاء جلسة لمشرف البرنامج أو المدير
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  create(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessionsService.create(dto, user);
  }

  // تعديل جلسة
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessionsService.update(id, dto, user);
  }

  // حذف جلسة
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessionsService.remove(id, user);
  }
}
