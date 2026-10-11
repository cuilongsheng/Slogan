import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
export class PublicRoomQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}
export class PublicRoomSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() topic!: string;
  @ApiProperty({ enum: ['INSTANT', 'APPOINTMENT'] }) kind!: string;
  @ApiProperty({ enum: ['OPEN', 'SCHEDULED'] }) status!: string;
  @ApiProperty() cefrLevel!: string;
  @ApiProperty({ nullable: true, type: String }) cefrLevelMin!: string | null;
  @ApiProperty({ nullable: true, type: String }) cefrLevelMax!: string | null;
  @ApiProperty() capacity!: number;
  @ApiProperty() memberCount!: number;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class PublicRoomListDto {
  @ApiProperty({ type: [PublicRoomSummaryDto] }) items!: PublicRoomSummaryDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
  @ApiProperty() openCount!: number;
  @ApiProperty() scheduledCount!: number;
}
