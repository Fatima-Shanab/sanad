
import { PartialType } from '@nestjs/mapped-types';
import { CreateProgramDto } from './create-program.dto.js';


export class UpdateProgramDto extends PartialType(CreateProgramDto) {}
