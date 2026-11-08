
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ApplicationsService } from './applications.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ReviewApplicationDto } from './dto/review-application.dto.js';


type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Post()
  @Roles(Role.YOUTH)
  create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.applicationsService.create(
      user,
      dto.programId,
      dto.cvPath,
    );
  }

  @Get('my')
  @Roles(Role.YOUTH)
  findMyApplications(@CurrentUser() user: AuthUser) {
    return this.applicationsService.findMyApplications(user);
  }

  @Get('admin/all')
  @Roles(Role.ADMIN)
  findAllForAdmin(@CurrentUser() user: AuthUser) {
    return this.applicationsService.findAllForAdmin(user);
  }

  @Patch(':id/review')
  @Roles(Role.ADMIN)
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewApplicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.applicationsService.review(
      id,
      dto.status,
      user,
    );
  }

  @Patch(':id/cancel')
  @Roles(Role.YOUTH)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.applicationsService.cancel(id, user);
  }
}
