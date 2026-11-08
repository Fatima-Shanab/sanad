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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AnnouncementsService } from './announcements.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js';



type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(
    private readonly announcementsService: AnnouncementsService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.announcementsService.findAll(user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.announcementsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.announcementsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.announcementsService.remove(id, user);
  }
}