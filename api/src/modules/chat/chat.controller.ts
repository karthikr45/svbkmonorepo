import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatService, ChatCaller } from './chat.service';
import {
  MarkReadDto,
  SendMessageDto,
  StartConversationDto,
  ListMessagesQueryDto,
} from './dto/chat.dto';

function caller(req: Request): ChatCaller {
  const user = (req as any).user;
  if (!user?.userId) throw new UnauthorizedException('Authentication required');
  return {
    userId: user.userId,
    role: user.role,
    tenantId: user.tenantId ?? null,
  };
}

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('contacts')
  @ApiOperation({
    summary: 'List everyone the caller is allowed to chat with',
    description:
      'Super-admin: returns all active admins across tenants. Tenant ' +
      'users: returns same-tenant admins plus all super-admins.',
  })
  listContacts(@Req() req: Request) {
    return this.chat.listContacts(caller(req));
  }

  @Get('conversations')
  @ApiOperation({ summary: 'My conversations + last message + unread counts' })
  listConversations(@Req() req: Request) {
    return this.chat.listMyConversations(caller(req));
  }

  @Get('unread')
  @ApiOperation({ summary: 'Single number for the navbar badge' })
  async unread(@Req() req: Request) {
    return { unread: await this.chat.unreadTotal(caller(req)) };
  }

  @Post('conversations/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get-or-create a 1:1 conversation with peerAdminId' })
  start(@Req() req: Request, @Body() dto: StartConversationDto) {
    return this.chat.startConversation(caller(req), dto.peerAdminId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Page through messages in a conversation (newest last)' })
  messages(
    @Req() req: Request,
    @Param('id') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    const limit = query.limit ? Number(query.limit) : 50;
    return this.chat.listMessages(
      caller(req),
      conversationId,
      Number.isFinite(limit) ? limit : 50,
      query.beforeId,
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  send(
    @Req() req: Request,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(caller(req), conversationId, dto.body);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark messages read up to the supplied messageId' })
  async markRead(
    @Req() req: Request,
    @Param('id') conversationId: string,
    @Body() dto: MarkReadDto,
  ) {
    await this.chat.markRead(caller(req), conversationId, dto.messageId);
  }
}
