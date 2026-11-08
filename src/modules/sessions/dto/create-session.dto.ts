
import {IsDateString,IsInt,IsOptional,IsString,IsUrl,Min,MaxLength} from 'class-validator';

export class CreateSessionDto {
  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  meetingUrl?: string;

  @IsInt()
  @Min(1)
  programId: number;
}
