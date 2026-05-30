import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChatbotService } from './chatbot.service';
import { AskChatbotDto } from './dto/ask.dto';
import { ChatbotCaller } from './intents/intent.types';

/**
 * Lift the authenticated caller off the request. `Request.user` is
 * typed via the global augmentation in src/types/express.d.ts —
 * matches what JwtStrategy.validate returns. Throws 401 if missing,
 * which only happens for unauthenticated calls (guards normally catch
 * those first; belt-and-braces).
 */
function callerFrom(req: Request): ChatbotCaller {
  const u = req.user;
  if (!u?.userId) throw new UnauthorizedException();
  return {
    userId: u.userId,
    tenantId: u.tenantId ?? null,
    role: u.role,
  };
}

@ApiTags('chatbot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  /**
   * Streams the answer as Server-Sent Events. The client opens an
   * EventSource and listens for the named events (`typing`, `intent`,
   * `data`, `token`, `chips`, `error`, `done`).
   *
   * Tighter rate limit than the global throttler since each call can
   * fan out to multiple DB queries (and one LLM call once enabled).
   */
  @Post('ask')
  @Sse()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Ask the chatbot (Server-Sent Events stream)' })
  ask(
    @Req() req: Request,
    @Body() dto: AskChatbotDto,
  ): Observable<MessageEvent> {
    const caller = callerFrom(req);
    return this.chatbot.ask(caller, dto.message, dto.conversationId);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'List my chatbot conversations (most recent first)',
  })
  listConversations(@Req() req: Request) {
    return this.chatbot.listConversations(callerFrom(req));
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get one conversation with its messages' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  getConversation(@Req() req: Request, @Param('id') id: string) {
    return this.chatbot.getConversation(callerFrom(req), id);
  }
}
