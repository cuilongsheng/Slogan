import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssistanceRoomParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId!: string;
}

export class TextExpressionRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  text!: string;
}

export class AudioExpressionRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty({ maxLength: 64 })
  @IsString()
  @MaxLength(64)
  noticeVersion!: string;

  @ApiProperty()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  noticeConfirmed!: boolean;

  @ApiPropertyOptional({ example: 'zh-CN' })
  @IsOptional()
  @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
  sourceLanguageCode?: string;
}

export class ConsentCommandDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty({ enum: ['ACCEPT', 'REVOKE'] })
  @IsIn(['ACCEPT', 'REVOKE'])
  action!: 'ACCEPT' | 'REVOKE';

  @ApiProperty({ maxLength: 64 })
  @IsString()
  @MaxLength(64)
  noticeVersion!: string;
}

export class ExpressionItemDto {
  @ApiProperty() text!: string;
  @ApiProperty({ enum: ['NEUTRAL', 'CASUAL', 'POLITE'] }) tone!: string;
}

export class ExpressionResultDto {
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ type: ExpressionItemDto }) primary!: ExpressionItemDto;
  @ApiProperty({ type: [ExpressionItemDto] }) alternatives!: ExpressionItemDto[];
  @ApiProperty({ enum: ['AI_OUTPUT_MAY_BE_INACCURATE'] }) noticeCode!: string;
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

export class ConsentStateDto {
  @ApiProperty({
    enum: ['AI_EXPRESSION_AUDIO', 'ROOM_SAFETY_DETECTION', 'POST_ROOM_KEYWORDS'],
  })
  purpose!: string;
  @ApiPropertyOptional({ nullable: true }) noticeVersion!: string | null;
  @ApiPropertyOptional({ nullable: true }) providerCategory!: string | null;
  @ApiProperty({ enum: ['ACCEPTED', 'REVOKED', 'REQUIRED'] }) status!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) changedAt!: string | null;
}

export class ConsentStatePageDto {
  @ApiProperty({ type: [ConsentStateDto] }) items!: ConsentStateDto[];
}
