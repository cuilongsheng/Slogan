import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KeywordSummaryRoomParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId!: string;
}

export class VocabularyItemParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId!: string;
}

export class KeywordSummaryItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['KEYWORD', 'EXPRESSION'] }) kind!: string;
  @ApiProperty() text!: string;
  @ApiProperty({ minimum: 1 }) rank!: number;
}

export class KeywordSummaryDto {
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty() topic!: string;
  @ApiProperty({ enum: ['DISABLED', 'PENDING', 'READY', 'UNAVAILABLE'] }) status!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) generatedAt!:
    string | null;
  @ApiProperty({ type: [KeywordSummaryItemDto] }) items!: KeywordSummaryItemDto[];
}

export class ImportVocabularyItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sourceSummaryItemId!: string;
}

export class UpdateVocabularyItemDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  text?: string;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}

export class DeleteVocabularyItemDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ListVocabularyItemsQueryDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  favorite?: boolean;

  @ApiPropertyOptional({ enum: ['KEYWORD', 'EXPRESSION'] })
  @IsOptional()
  @IsIn(['KEYWORD', 'EXPRESSION'])
  kind?: 'KEYWORD' | 'EXPRESSION';
}

export class VocabularyItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['KEYWORD', 'EXPRESSION'] }) kind!: string;
  @ApiProperty() text!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) note!: string | null;
  @ApiProperty() favorite!: boolean;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class VocabularyItemListDto {
  @ApiProperty({ type: [VocabularyItemDto] }) items!: VocabularyItemDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) nextCursor!: string | null;
}
