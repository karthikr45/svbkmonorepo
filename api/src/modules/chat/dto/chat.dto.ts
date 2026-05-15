import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({ description: 'Admin user id to start the conversation with' })
  @IsString()
  @IsNotEmpty()
  peerAdminId: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Can you confirm the cheque cleared?', maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;
}

export class MarkReadDto {
  @ApiProperty({ description: 'Last message id this user has seen' })
  @IsString()
  @IsNotEmpty()
  messageId: string;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Fetch messages older than this id' })
  @IsOptional()
  @IsString()
  beforeId?: string;
}
