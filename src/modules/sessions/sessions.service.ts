
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';


type AuthUser = {
  userId: number;
  email: string;
  role: Role;
};

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkProgramAccess(programId: number,user: AuthUser,)
   {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, supervisorId: true },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    if (
      user.role !== Role.ADMIN &&
      (user.role !== Role.SUPERVISOR ||program.supervisorId !== user.userId)
    ) {
      throw new ForbiddenException('You cannot manage sessions for this program',
      );
    }

    return program;
  }

  async create(dto: CreateSessionDto, user: AuthUser) 
  {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'Session end time must be after start time',
      );
    }

    await this.checkProgramAccess(dto.programId, user);

    return this.prisma.details_Session.create({
      data: {
        startsAt,
        endsAt,
        location: dto.location,
        meetingUrl: dto.meetingUrl,
        programId: dto.programId,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        location: true,
        meetingUrl: true,
        programId: true,
        createdAt: true,
      },
    });
  }

  async findByProgram(programId: number) {
    const program = await this.prisma.program.findFirst({
      where: {id: programId, },
      select: { id: true },
    });

    if (!program) {
      throw new NotFoundException(' program not found');
    }

    return this.prisma.details_Session.findMany({
      where: { programId },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        location: true,
        meetingUrl: true,
      },
    });
  }

  async update(id: number,dto: UpdateSessionDto,user: AuthUser,)
   {
    const session = await this.prisma.details_Session.findUnique({
      where: { id },
      select: {
        id: true,
        programId: true,
        startsAt: true,
        endsAt: true,
        location:true,
      
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.checkProgramAccess(session.programId, user);

    const startsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : session.startsAt;
    const endsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : session.endsAt;

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException(
        'Session end time must be after start time',
      );
    }

    return this.prisma.details_Session.update({
      where: { id },
      data: {
        ...(dto.startsAt !== undefined && { startsAt }),
        ...(dto.endsAt !== undefined && { endsAt }),
        ...(dto.location !== undefined && {location: dto.location,}),
        ...(dto.meetingUrl !== undefined && {meetingUrl: dto.meetingUrl,}),
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        location: true,
        meetingUrl: true,
        programId: true,
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    const session = await this.prisma.details_Session.findUnique({
      where: { id },
      select: { id: true, programId: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.checkProgramAccess(session.programId, user);

    await this.prisma.details_Session.delete({
      where: { id },
    });

    return { message: 'Session deleted successfully' };
  }
}
