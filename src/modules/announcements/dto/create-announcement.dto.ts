import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  programId?: number;
}