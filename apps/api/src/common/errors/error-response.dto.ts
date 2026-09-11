import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code!: string;

  @ApiProperty({ example: 'Request validation failed' })
  message!: string;

  @ApiPropertyOptional({ type: Object })
  details?: unknown;

  @ApiPropertyOptional({ example: '5b27b1e0-f183-46f6-b9e8-1421235a8bb1' })
  requestId?: string;
}
