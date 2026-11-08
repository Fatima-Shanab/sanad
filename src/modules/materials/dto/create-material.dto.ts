import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMaterialDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;
}