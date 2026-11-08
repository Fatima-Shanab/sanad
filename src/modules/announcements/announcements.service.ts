import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';



type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // عرض الإعلانات حسب دور المستخدم
  async findAll(user: AuthUser) {
    // مفتاح كاش خاص بكل مستخدم بناءً على دوره ومساره لضمان الخصوصية والصلاحيات
    const cacheKey = `announcements_user_${user.userId}_role_${user.role}`;
    
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData; // إرجاع البيانات مباشرة من الكاش إذا وجدت
    }
    let where: any = {};

    if (user.role === Role.ADMIN) {
      // المدير يستطيع مشاهدة جميع الإعلانات
      where = {};
    } else if (user.role === Role.SUPERVISOR) {
      // المشرف يرى الإعلانات العامة وإعلانات برامجه
      where = {
        OR: [
          { programId: null },
          {
            program: {
              supervisorId: user.userId,
            },
          },
        ],
      };
    } else {
      // الشباب يرون الإعلانات العامة
      // وإعلانات البرامج التي لديهم طلب تسجيل فيها
      where = {
        OR: [
          { programId: null },
          {
            program: {
              applications: {
                some: {
                  userId: user.userId,
                },
              },
            },
          },
        ],
      };
    }

   const announcements = await this.prisma.announcement.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        program: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // حفظ النتائج في الكاش لمدة 5 دقائق (300000 ميلي ثانية)
    await this.cacheManager.set(cacheKey, announcements, 300000);

    return announcements;
  }

  // إنشاء إعلان
  async create(dto: CreateAnnouncementDto, user: AuthUser) {
    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.SUPERVISOR
    ) {
      throw new ForbiddenException(
        'Only admins and supervisors can create announcements',
      );
    }

    if (user.role === Role.SUPERVISOR) {
      if (!dto.programId) {
        throw new ForbiddenException(
          'Supervisors can only create program announcements',
        );
      }

      const program = await this.prisma.program.findFirst({
        where: {
          id: dto.programId,
          supervisorId: user.userId,
        },
      });

      if (!program) {
        throw new ForbiddenException(
          'You can only announce in your own programs',
        );
      }
    }

    if (dto.programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: dto.programId },
        select: { id: true },
      });

      if (!program) {
        throw new NotFoundException('Program not found');
      }
    }

    const newAnnouncement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        programId: dto.programId ?? null,
        authorId: user.userId,
      },
    });

    // إبطال كاش الإعلانات لكي تظهر التحديثات فوراً للمستخدمين
 await this.cacheManager.del(`announcements_user_${user.userId}_role_${user.role}`);

    return newAnnouncement;
  }

  // تعديل إعلان
  async update(
    id: number,
    dto: UpdateAnnouncementDto,
    user: AuthUser,
  ) {
    const announcement =
      await this.prisma.announcement.findUnique({
        where: { id },
        select: {
          id: true,
          programId: true,
          program: {
            select: {
              supervisorId: true,
            },
          },
        },
      });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    if (user.role === Role.SUPERVISOR) {
      if (
        !announcement.program ||
        announcement.program.supervisorId !== user.userId
      ) {
        throw new ForbiddenException(
          'You cannot edit this announcement',
        );
      }

      if (dto.programId !== undefined) {
        if (dto.programId === null) {
          throw new ForbiddenException(
            'Supervisors cannot create general announcements',
          );
        }

        const newProgram = await this.prisma.program.findFirst({
          where: {
            id: dto.programId,
            supervisorId: user.userId,
          },
        });

        if (!newProgram) {
          throw new ForbiddenException(
            'You can only use your own programs',
          );
        }
      }
    }

    if (dto.programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: dto.programId },
        select: { id: true },
      });

      if (!program) {
        throw new NotFoundException('Program not found');
      }
    }

   const updatedAnnouncement = await this.prisma.announcement.update({
      where: { id },
      data: dto,
    });

    // إبطال الكاش بعد التعديل
    await this.cacheManager.del(`announcements_user_${user.userId}_role_${user.role}`);

    return updatedAnnouncement;
  }

  // حذف إعلان
  async remove(id: number, user: AuthUser) {
    const announcement =
      await this.prisma.announcement.findUnique({
        where: { id },
        select: {
          id: true,
          program: {
            select: {
              supervisorId: true,
            },
          },
        },
      });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    if (
      user.role === Role.SUPERVISOR &&
      (
        !announcement.program ||
        announcement.program.supervisorId !== user.userId
      )
    ) {
      throw new ForbiddenException(
        'You cannot delete this announcement',
      );
    }

    await this.prisma.announcement.delete({
      where: { id },
    });
    
    await this.cacheManager.del(`announcements_user_${user.userId}_role_${user.role}`);

    return {
      message: 'Announcement deleted successfully',
    };
  }

}