
import {Controller,Get,Post,Patch,Delete,Body,Param,Query,
  ParseIntPipe,UseGuards,UseInterceptors,Req, UploadedFile, BadRequestException,} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '../../generated/prisma/enums.js';
import { ProgramsService } from './programs.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';


type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};


type AuthenticatedRequest = Request & {
  user: AuthUser;
};

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.programsService.findAll(
      Number(page),
      Number(limit),
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.programsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @UseInterceptors(
  FileInterceptor('image', {
  storage: diskStorage({
  destination: './uploads/program',
  filename: (req, file, cb) =>
  cb(null, randomUUID() + extname(file.originalname)),
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
  if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
  return cb(new BadRequestException('Only jpg, png, webp'), false);
  }
  cb(null, true);
  },
  }),
  )
  createProgram(
  @Body() createProgramDto: CreateProgramDto,
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: AuthUser,
  )
   {
  if (!file) throw new BadRequestException('Image is required');

  createProgramDto.imagePath = `/uploads/program/${file.filename}`;
  const imagePath = file ? `/uploads/program/${file.filename}` : null;
  return this.programsService.create(createProgramDto, user);  
  }


  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
 @UseInterceptors(
  FileInterceptor('image', {
  storage: diskStorage({
  destination: './uploads/program',
  filename: (req, file, cb) =>
  cb(null, randomUUID() + extname(file.originalname)),
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
  if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
  return cb(new BadRequestException('Only jpg, png, webp'), false);
  }
  cb(null, true);
  },
  }),
  )
  UpdateProgram(
  @Param('id', ParseIntPipe) id: number,
  @Body() updateProgramDto: UpdateProgramDto,
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: AuthUser,
  )
   {
  
  if (file) {
    updateProgramDto.imagePath = `/uploads/program/${file.filename}`;
  }

  return this.programsService.update(id, updateProgramDto, user);
}

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.programsService.remove(id, user);
  }
  }
