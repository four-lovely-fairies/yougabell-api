import { ApiProperty } from '@nestjs/swagger';
import { PushPlatform } from '@prisma/client';
import {
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertPushTokenDto {
  @ApiProperty({ example: 'ios-device-uuid' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  deviceId!: string;

  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/, {
    message: 'token must be an Expo push token',
  })
  token!: string;

  @ApiProperty({ enum: PushPlatform, example: PushPlatform.ios })
  @IsEnum(PushPlatform)
  platform!: PushPlatform;
}

export class UpsertPushTokenResponseDto {
  @ApiProperty({ example: true })
  ok!: true;
}

export class DeletePushTokenResponseDto {
  @ApiProperty({ example: 1 })
  deletedCount!: number;
}
