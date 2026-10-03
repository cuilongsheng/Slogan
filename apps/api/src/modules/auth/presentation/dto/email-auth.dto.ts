import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, MaxLength, Matches } from 'class-validator';
export class EmailPasswordDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
    description: '8–128 Unicode code points; preserved without trimming',
  })
  @IsString()
  @MaxLength(256)
  password!: string;
}
export class EmailLoginDto extends EmailPasswordDto {
  @ApiProperty({ minLength: 3, maxLength: 20 })
  @IsString()
  @MaxLength(100)
  username!: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}
export class EmailRegistrationDto extends EmailPasswordDto {
  @ApiProperty({ minLength: 3, maxLength: 20 })
  @IsString()
  @MaxLength(100)
  username!: string;
  @ApiProperty({ format: 'email', maxLength: 254 })
  @IsString()
  @MaxLength(300)
  email!: string;
}
export class EmailTokenDto {
  @ApiProperty({ pattern: '^[A-Za-z0-9_-]{43}$', writeOnly: true })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
export class EmailResendDto {
  @ApiProperty({ pattern: '^[A-Za-z0-9_-]{43}$', writeOnly: true })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  managementToken!: string;
}
export class EmailResetRequestDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @IsString()
  @MaxLength(300)
  email!: string;
}
export class EmailResetDto extends EmailPasswordDto {
  @ApiProperty({ pattern: '^[A-Za-z0-9_-]{43}$', writeOnly: true })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
export class EmailLinkDto extends EmailRegistrationDto {
  @ApiProperty({ pattern: '^[A-Za-z0-9_-]{43}$', writeOnly: true })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  proof!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;
}
export class EmailDeletionProofDto extends EmailPasswordDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientRequestId!: string;
}
export class EmailResendResponseDto {
  @ApiProperty({ format: 'date-time' }) resendAt!: string;
}
export class EmailEnrollmentResponseDto extends EmailResendResponseDto {
  @ApiProperty({ minLength: 43, maxLength: 43 }) managementToken!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
export class EmailVerifiedResponseDto {
  @ApiProperty({ enum: [true] }) verified!: boolean;
}
export class EmailAcceptedResponseDto {
  @ApiProperty({ enum: [true] }) accepted!: boolean;
}
