import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';



import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { ApplicationStatus, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';

type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  // التحقق من صلاحية المستخدم على البرنامج
  private async checkProgramAccess(
    programId: number,
    user: AuthUser,
    requireAccepted = false,
  ) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        supervisorId: true,
      },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    if (user.role === Role.ADMIN) {
      return program;
    }

    if (user.role === Role.SUPERVISOR) {
      if (program.supervisorId !== user.userId) {
        throw new ForbiddenException(
          'You cannot access this program',
        );
      }

      return program;
    }

    if (user.role === Role.YOUTH) {
      if (!requireAccepted) {
        throw new ForbiddenException(
          'You cannot manage program materials',
        );
      }

      const application =
        await this.prisma.application.findFirst({
          where: {
            userId: user.userId,
            programId,
            status: ApplicationStatus.ACCEPTED,
          },
        });

      if (!application) {
        throw new ForbiddenException(
          'You must be accepted into this program',
        );
      }

      return program;
    }

    throw new ForbiddenException('Access denied');
  }

  // رفع مادة جديدة
  async create(
    programId: number,
    dto: CreateMaterialDto,
    file: Express.Multer.File,
    user: AuthUser,
  ) {
    if (!file) {
      throw new NotFoundException('File is required');
    }

    await this.checkProgramAccess(programId, user);

    try {
      return await this.prisma.material.create({
        data: {
          title: dto.title,
          filePath: file.path,
          fileType: file.mimetype,
          fileSize: file.size,
          programId,
        },
        select: {
          id: true,
          title: true,
          fileType: true,
          fileSize: true,
          createdAt: true,
          programId: true,
        },
      });
    } catch (error) {
      await unlink(file.path).catch(() => undefined);
      throw error;
    }
  }

  // عرض مواد برنامج
  async findByProgram(
    programId: number,
    user: AuthUser,
  ) {
    await this.checkProgramAccess(
      programId,
      user,
      user.role === Role.YOUTH,
    );

    return this.prisma.material.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        programId: true,
      },
    });
  }

  // جلب مادة مع التحقق من صلاحية تنزيلها
  async getFile(
    id: number,
    user: AuthUser,
  ) {
    const material = await this.prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    await this.checkProgramAccess(
      material.programId,
      user,
      user.role === Role.YOUTH,
    );

    const filePath = resolve(material.filePath);

    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on server');
    }

    return {
      filePath,
      fileName: basename(filePath),
      fileType: material.fileType,
    };
  }

  // حذف مادة
  async remove(
    id: number,
    user: AuthUser,
  ) {
    const material = await this.prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    await this.checkProgramAccess(material.programId, user);

    await this.prisma.material.delete({
      where: { id },
    });

    await unlink(material.filePath).catch(() => undefined);

    return {
      message: 'Material deleted successfully',
    };
  }
}