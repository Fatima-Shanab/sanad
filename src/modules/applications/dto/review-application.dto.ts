
import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../../../generated/prisma/enums.js';

export class ReviewApplicationDto {
  @IsEnum(ApplicationStatus) status: ApplicationStatus;
}
