import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class ExtendRoomDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty({ minimum: 1, maximum: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  additionalMinutes!: number;
}

export class RoomExtensionResultDto {
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty({ format: 'date-time' }) previousEndsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ minimum: 1, maximum: 3 }) extensionCount!: number;
  @ApiProperty({ minimum: 0, maximum: 2 }) remainingExtensions!: number;
  @ApiProperty({ minimum: 1 }) stateVersion!: number;
  @ApiProperty({ enum: ['COMPLETED', 'PENDING', 'UNAVAILABLE'] })
  providerStatus!: 'COMPLETED' | 'PENDING' | 'UNAVAILABLE';
}
