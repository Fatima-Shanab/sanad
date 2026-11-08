
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import path from 'path';
import * as fs from 'fs/promises';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Injectable()
export class ProgramsService {
  constructor(
  private readonly prisma: PrismaService,
  @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(page = 1, limit = 10, search?: string) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));  

    const where = {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              {
                description: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.program.findMany({
        where,
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          imagePath: true,
          capacity: true,
          createdAt: true,
          supervisor: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.program.count({ where }),
    ]);

    const programsWithSeats = await Promise.all(
  data.map(async (program) => {
    const reservedSeats = await this.prisma.application.count({
      where: {
        programId: program.id,
        status: {
          in: [ApplicationStatus.PENDING, ApplicationStatus.ACCEPTED],
        },
      },
    });

    return {
      ...program,
      reservedSeats,
      remainingSeats: Math.max(0, program.capacity - reservedSeats),
    };
  }),
);

    return {
      data: programsWithSeats,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: number) {
    const cacheKey = `program_detail_${id}`;
    const cachedProgram = await this.cacheManager.get(cacheKey);
    if (cachedProgram) {
      return cachedProgram; // إرجاع تفاصيل البرنامج من الكاش
    }
    const program = await this.prisma.program.findFirst({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        imagePath: true,
        capacity: true,
        createdAt: true,
        supervisor: {
          select: { id: true, name: true },
        },
        details_sessions: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            location: true,
            meetingUrl: true,
          },
          orderBy: { startsAt: 'asc' },
        },
      },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }
    const reservedSeats = await this.prisma.application.count({
  where: {
    programId: id,
    status: {
      in: [
        ApplicationStatus.PENDING,
        ApplicationStatus.ACCEPTED,
      ],
    },
  },
});

const remainingSeats = Math.max(
  0,
  program.capacity - reservedSeats,
);

const result = {
      ...program,
      reservedSeats,
      remainingSeats,
    };
// حفظ تفاصيل البرنامج في الكاش
await this.cacheManager.set(cacheKey, result, 300000);

    return result;
  }

  async create(dto: CreateProgramDto, user: AuthUser) {
    if (user.role !== Role.SUPERVISOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only supervisors and admins can create programs');
    }

    return this.prisma.program.create({
      data: {
        title: dto.title,
        description: dto.description,
        capacity: dto.capacity,
        imagePath: dto.imagePath,
        supervisorId: user.userId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        capacity: true,
        imagePath: true,
        supervisorId: true,
        createdAt: true,
      },
    });
  }

  async update(id: number, dto: UpdateProgramDto, user: AuthUser) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      select: { id: true, supervisorId: true },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    if (
      user.role !== Role.ADMIN &&
      (user.role !== Role.SUPERVISOR || program.supervisorId !== user.userId)
    ) {
      throw new ForbiddenException('You cannot edit this program');
    }

    await this.cacheManager.del(`program_detail_${id}`);

   const updatedProgram = await this.prisma.program.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        title: true,
        description: true,
        capacity: true,
        imagePath: true,
        supervisorId: true,
        updatedAt: true,
      },
    });

    //إبطال كاش تفاصيل هذا البرنامج 
    await this.cacheManager.del(`program_detail_${id}`);

    return updatedProgram;
  }

  async remove(id: number, user: AuthUser) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      select: { id: true, supervisorId: true,imagePath: true },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    if (
      user.role !== Role.ADMIN &&
      (user.role !== Role.SUPERVISOR || program.supervisorId !== user.userId)
    ) {
      throw new ForbiddenException('You cannot delete this program');
    }
   // حذف الصورة من مجلد uploads إذا كانت موجودة
    if (program.imagePath) {
    try {
      const filePath = path.join(process.cwd(), program.imagePath);
      await fs.unlink(filePath);
    } catch (error) {
       console.error('Failed to delete image file:', error);
    }
  }
    await this.prisma.program.delete({ where: { id } });
    
    await this.cacheManager.del(`program_detail_${id}`);

    return { message: 'Program deleted successfully' };
  }
}
