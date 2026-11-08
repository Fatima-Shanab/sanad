
import { IsInt, IsOptional, Min, IsString, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @IsInt()
  @Min(1)
  programId: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cvPath?: string;
}
