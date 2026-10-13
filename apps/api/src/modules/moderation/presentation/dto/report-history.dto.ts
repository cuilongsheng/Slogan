import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { REPORT_CATEGORIES, type ReportCategory } from '../../domain/entities/report.js';
import { REPORT_PROGRESS, type ReportProgress } from '../../domain/entities/report-history.js';

export class PersonalReportQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}
export class PersonalReportDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) caseId!: string | null;
  @ApiProperty({ enum: ['ROOM', 'ROOM_MEMBER', 'DIRECT_MESSAGE'] }) kind!:
    'ROOM' | 'ROOM_MEMBER' | 'DIRECT_MESSAGE';
  @ApiProperty({ type: String, nullable: true }) roomTopic!: string | null;
  @ApiProperty({ enum: REPORT_CATEGORIES }) category!: ReportCategory;
  @ApiProperty({ enum: REPORT_PROGRESS }) status!: ReportProgress;
  @ApiProperty({ format: 'date-time' }) submittedAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) decidedAt!: string | null;
}
export class PersonalReportPageDto {
  @ApiProperty({ type: [PersonalReportDto] }) items!: PersonalReportDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
