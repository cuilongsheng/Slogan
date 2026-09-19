import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID } from 'class-validator';
import { REPORT_CATEGORIES, type ReportCategory } from '../../domain/entities/report.js';
export class SubmitReportDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() targetUserId!: string;
  @ApiProperty({
    format: 'uuid',
    description:
      'Idempotency identifier scoped to the authenticated reporter. Reuse only for equivalent normalized content.',
  })
  @IsUUID()
  clientRequestId!: string;
  @ApiProperty({ enum: REPORT_CATEGORIES }) @IsIn(REPORT_CATEGORIES) category!: ReportCategory;
  @ApiProperty({
    minLength: 1,
    maxLength: 2000,
    description:
      'Plain text. Trimmed before validation; 1–2000 Unicode code points. Never included in response or audit.',
  })
  @IsString()
  description!: string;
}
export class ReportRoomParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() roomId!: string;
}
export class ReportReceiptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) caseId!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'First submission server time, retained on retries.',
  })
  submittedAt!: string;
}
