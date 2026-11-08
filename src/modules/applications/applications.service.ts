
import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,

} from '@nestjs/common';
import { ApplicationStatus, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // تقديم طلب جديد مع حماية سعة البرنامج من الطلبات المتزامنة
// تقديم طلب جديد مع حماية سعة البرنامج من الطلبات المتزامنة
  async create(user: AuthUser, programId: number, cvPath?: string) {
    if (user.role !== Role.YOUTH) {
      throw new ForbiddenException('Only youth users can apply');
    }

    let createdApplication: any;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        createdApplication = await this.prisma.$transaction(
          async (tx) => {
            const program = await tx.program.findFirst({
              where: { id: programId },
              select: {
                id: true,
                capacity: true,
              },
            });

            if (!program) {
              throw new NotFoundException('program not found');
            }

            const existing = await tx.application.findUnique({
              where: {
                userId_programId: {
                  userId: user.userId,
                  programId,
                },
              },
              select: { id: true },
            });

            if (existing) {
              throw new ConflictException(
                'You have already applied to this program',
              );
            }

            const occupiedSeats = await tx.application.count({
              where: {
                programId,
                status: {
                  in: [
                    ApplicationStatus.PENDING,
                    ApplicationStatus.ACCEPTED,
                  ],
                },
              },
            });

            if (occupiedSeats >= program.capacity) {
              throw new ConflictException(
                'This program has no available seats',
              );
            }

            return tx.application.create({
              data: {
                userId: user.userId,
                programId,
                cvPath,
                status: ApplicationStatus.PENDING,
              },
              select: {
                id: true,
                status: true,
                cvPath: true,
                createdAt: true,
                program: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            });
          },
          {
            isolationLevel: 'Serializable',
          },
        );
        break; // نجحت المعاملة بنجاح
      } catch (error: unknown) {
        const code = (error as { code?: string })?.code;

        if (code === 'P2002') {
          throw new ConflictException(
            'You have already applied to this program',
          );
        }

        if (code === 'P2034' && attempt < 3) {
          continue;
        }

        if (code === 'P2034') {
          throw new ConflictException(
            'The program is busy. Please try again',
          );
        }

        throw error;
      }
    }

    if (!createdApplication) {
      throw new ConflictException('Please try again');
    }

    // بمجرد نجاح حجز المقعد، نقوم بمسح كاش تفاصيل هذا البرنامج ليتحدث عدد المقاعد فوراً
    await this.cacheManager.del(`program_detail_${programId}`);

    return createdApplication;
  }

  // عرض طلبات المستخدم الحالي فقط
  async findMyApplications(user: AuthUser) {
    return this.prisma.application.findMany({
      where: {
        userId: user.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        status: true,
        cvPath: true,
        createdAt: true,
        updatedAt: true,
        program: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });
  }

  // عرض الطلبات لجميع المستخدمين: للمدير فقط
  async findAllForAdmin(user: AuthUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Admins only');
    }

    return this.prisma.application.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        status: true,
        cvPath: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
  }

  // قبول أو رفض طلب من قبل المدير
  async review(
    applicationId: number,
    status: ApplicationStatus,
    user: AuthUser,
  ) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Admins only');
    }

    if (
      status !== ApplicationStatus.ACCEPTED &&
      status !== ApplicationStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Status must be ACCEPTED or REJECTED',
      );
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        programId: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new ConflictException(
        'Only pending applications can be reviewed',
      );
    }

    // التحديث المشروط يمنع تغيير الطلب إذا تمت مراجعته مسبقًا
    const result = await this.prisma.application.updateMany({
      where: {
        id: applicationId,
        status: ApplicationStatus.PENDING,
      },
      data: { status },
    });

    if (result.count === 0) {
      throw new ConflictException(
        'This application has already been reviewed',
      );
    }
    // مسح كاش البرنامج لتحديث المقاعد المتاحة
    await this.cacheManager.del(`program_detail_${application.programId}`);

    return this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  // إلغاء المستخدم لطلبه
  async cancel(applicationId: number, user: AuthUser) {

     const application = await this.prisma.application.findFirst({
        where: {
          id: applicationId,
          userId: user.userId,
          
        },
        select: { id: true,programId: true },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

    if (user.role !== Role.YOUTH) {
      throw new ForbiddenException(
        'Only youth users can cancel their applications',
      );
    }

    const result = await this.prisma.application.updateMany({
      where: {
        id: applicationId,
        userId: user.userId,
        status: ApplicationStatus.PENDING,
      },
      data: {
        status: ApplicationStatus.CANCELLED,
      },
    });

    if (result.count === 0) {
      
      throw new ConflictException(
        'Only pending applications can be cancelled',
      );
    }

    await this.cacheManager.del(`program_detail_${application.programId}`);
    
    return {
      message: 'Application cancelled successfully',
    };
  }
}
