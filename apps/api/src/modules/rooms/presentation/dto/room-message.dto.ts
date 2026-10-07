import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
export class SendRoomMessageDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientRequestId!: string;
  @ApiProperty({ minLength: 1, maxLength: 1000 }) @IsString() text!: string;
}
export class RoomMessagesQueryDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
export class RoomMessageDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() sequence!: string;
  @ApiProperty({ format: 'uuid' }) senderUserId!: string;
  @ApiProperty() senderDisplayName!: string;
  @ApiProperty() text!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}
export class RoomMessagesPageDto {
  @ApiProperty({ type: [RoomMessageDto] }) items!: RoomMessageDto[];
  @ApiProperty() nextCursor!: string;
  @ApiProperty() hasMore!: boolean;
}
