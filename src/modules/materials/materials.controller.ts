import {Controller,Post,Get,Delete,Param,ParseIntPipe,Body,UploadedFile,UseInterceptors,UseGuards,
  BadRequestException,
  StreamableFile,
  Res,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { createReadStream } from 'node:fs';

import type { Response } from 'express';
import { Role } from '../../generated/prisma/enums.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MaterialsService } from './materials.service.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';



type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(
    private readonly materialsService: MaterialsService,
  ) {}

  // رفع مادة
  @Post('program/:programId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, callback) => {
          const uploadPath = join(
            process.cwd(),
            'uploads',
            'materials',
          );

          mkdirSync(uploadPath, { recursive: true });
          callback(null, uploadPath);
        },

        filename: (req, file, callback) => {
          const extension = extname(file.originalname).toLowerCase();
          callback(null, `${randomUUID()}${extension}`);
        },
      }),

      limits: {
        fileSize: 20 * 1024 * 1024,
      },

      fileFilter: (req, file, callback) => {
        const allowedExtensions =
          /\.(pdf|doc|docx|ppt|pptx)$/i;

        if (!allowedExtensions.test(file.originalname)) {
          return callback(
            new BadRequestException(
              'Only PDF, DOC, DOCX, PPT and PPTX files are allowed',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  upload(
    @Param('programId', ParseIntPipe) programId: number,
    @Body() dto: CreateMaterialDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.materialsService.create(
      programId,
      dto,
      file,
      user,
    );
  }

  // عرض مواد برنامج
  @Get('program/:programId')
  findByProgram(
    @Param('programId', ParseIntPipe) programId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.materialsService.findByProgram(
      programId,
      user,
    );
  }

  // تنزيل مادة
  @Get(':id/download')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.materialsService.getFile(
      id,
      user,
    );

    response.set({
      'Content-Type': file.fileType,
      'Content-Disposition':
        `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });

    return new StreamableFile(
      createReadStream(file.filePath),
    );
  }

  // حذف مادة
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.materialsService.remove(id, user);
  }
}