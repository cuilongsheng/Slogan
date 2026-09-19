import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsInt, Max, Min } from 'class-validator';
import { CreateRoomDto, JoinRoomDto } from './room.dto.js';
export class CreateAppointmentDto extends CreateRoomDto {
  @ApiProperty({ format: 'date-time' }) @IsISO8601({ strict: true }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) @IsISO8601({ strict: true }) endsAt!: string;
}
export class ReservationVersionDto {
  @ApiProperty({ minimum: 0, maximum: 2147483646 })
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedReservationVersion!: number;
}
export class ReserveAppointmentDto extends JoinRoomDto {
  @ApiProperty({ minimum: 0, maximum: 2147483646 })
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedReservationVersion!: number;
}
export class ReservationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['BOOKED', 'CANCELLED', 'CONSUMED', 'EXPIRED'] }) status!: string;
  @ApiProperty({ minimum: 1 }) version!: number;
}
export class AppointmentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) hostUserId!: string;
  @ApiProperty() topic!: string;
  @ApiProperty({ enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }) cefrLevel!: string;
  @ApiProperty({ minimum: 2, maximum: 6 }) capacity!: number;
  @ApiProperty({ enum: ['SCHEDULED', 'OPEN', 'ENDING', 'ENDED', 'CANCELLED'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() passwordProtected!: boolean;
  @ApiProperty({ minimum: 0 }) memberCount!: number;
  @ApiProperty({ minimum: 0 }) reservedCount!: number;
  @ApiProperty({ minimum: 0 }) availableCount!: number;
  @ApiProperty({ type: ReservationDto, nullable: true }) reservation!: ReservationDto | null;
  @ApiProperty({ enum: ['PUBLIC', 'LINK_ONLY'] }) visibility!: 'PUBLIC' | 'LINK_ONLY';
  @ApiProperty() sensitiveSpeechDetectionEnabled!: boolean;
  @ApiProperty() postRoomKeywordsEnabled!: boolean;
}
export class AppointmentDetailDto extends AppointmentDto {
  @ApiProperty({ format: 'uri' }) shareUrl!: string;
}
export class AppointmentListDto {
  @ApiProperty({ type: [AppointmentDto] }) items!: AppointmentDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
