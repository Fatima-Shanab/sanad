
import {IsInt,IsString,Min,MinLength,MaxLength,IsOptional,IsBoolean,} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProgramDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsString()
  imagePath?: string;

 
}
