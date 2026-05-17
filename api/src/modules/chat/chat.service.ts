import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Admin } from '../admins/entities/admin.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Role } from '../../common/enums/roles.enum';
import { AzureStorageService } from '../storage/azure-storage.service';

export interface MessageAttachment {
  url: string;
  name: string;
  mime: string;
  size: number;
}

/**
 * Caller identity used for every chat permission check. Lifted from the
 * JWT in the controller — never from the request body.
 */
export interface ChatCaller {
  userId: string;
  role: Role | string;
  tenantId: string | null;
}

export interface ContactRow {
  adminId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly partRepo: Repository<ConversationParticipant>,
    @InjectRepository(ChatMessage)
    private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: AzureStorageService,
  ) {}

  // ─── Permission rules ────────────────────────────────────────────

  /**
   * Returns true if `caller` is allowed to start / send messages to
   * the admin row identified by `peer`.
   * - SUPER_ADMIN: can chat with anyone.
   * - Other roles: can chat with super-admins (tenantId NULL) and with
   *   anyone in the SAME tenant. Cross-tenant peer chat is denied so
   *   information doesn't leak between schools.
   */
  private canChat(caller: ChatCaller, peer: Admin): boolean {
    if (caller.role === Role.SUPER_ADMIN) return true;
    if (peer.role === Role.SUPER_ADMIN) return true;
    return !!caller.tenantId && peer.tenantId === caller.tenantId;
  }

  // ─── Contacts ────────────────────────────────────────────────────

  /**
   * Lists every admin the caller is allowed to chat with, with the
   * tenant name attached (super-admin sees which school each contact
   * belongs to).
   */
  async listContacts(caller: ChatCaller): Promise<ContactRow[]> {
    // Two simple queries are more reliable than a uuid<->varchar join.
    // Get admin rows first, then look up tenant names in a separate query.
    const where = this.adminRepo
      .createQueryBuilder('a')
      .where('a.id != :me', { me: caller.userId })
      .andWhere('a.isActive = TRUE');

    if (caller.role !== Role.SUPER_ADMIN) {
      where.andWhere(
        '(a.tenantId = :tid OR a.role = :superRole)',
        { tid: caller.tenantId ?? '', superRole: Role.SUPER_ADMIN },
      );
    }
    const admins = await where
      .orderBy('a.firstName', 'ASC')
      .getMany();

    const tenantIds = Array.from(
      new Set(admins.map((a) => a.tenantId).filter((t): t is string => !!t)),
    );
    const tenants = tenantIds.length
      ? await this.tenantRepo.find({ where: { id: In(tenantIds) } })
      : [];
    const nameByTenant = new Map(
      tenants.map((t) => [t.id, t.tenantName ?? t.name ?? null]),
    );

    return admins
      .map((a) => ({
        adminId: a.id,
        email: a.email,
        firstName: a.firstName,
        lastName: a.lastName,
        role: a.role as string,
        tenantId: a.tenantId ?? null,
        tenantName: a.tenantId ? nameByTenant.get(a.tenantId) ?? null : null,
      }))
      .sort((x, y) => {
        const an = x.tenantName ?? '';
        const bn = y.tenantName ?? '';
        if (an !== bn) return an.localeCompare(bn);
        return (x.firstName ?? '').localeCompare(y.firstName ?? '');
      });
  }

  // ─── Conversations ───────────────────────────────────────────────

  /**
   * Lists conversations the caller participates in, newest activity
   * first. Each row includes the other participant's display info plus
   * an unread count.
   */
  async listMyConversations(caller: ChatCaller): Promise<
    Array<{
      conversationId: string;
      peer: ContactRow;
      lastMessagePreview: string | null;
      lastMessageAt: Date | null;
      unreadCount: number;
    }>
  > {
    const mine = await this.partRepo.find({ where: { adminId: caller.userId } });
    if (!mine.length) return [];
    const convIds = mine.map((p) => p.conversationId);

    const convs = await this.convRepo.find({ where: { id: In(convIds) } });
    const convById = new Map(convs.map((c) => [c.id, c]));

    // All other participants in these conversations.
    const otherParts = await this.partRepo
      .createQueryBuilder('p')
      .where('p.conversationId IN (:...convIds)', { convIds })
      .andWhere('p.adminId != :me', { me: caller.userId })
      .getMany();

    const adminIds = Array.from(new Set(otherParts.map((p) => p.adminId)));
    const adminRows = adminIds.length
      ? await this.adminRepo.find({ where: { id: In(adminIds) } })
      : [];
    const tenantIds = Array.from(
      new Set(
        adminRows.map((a) => a.tenantId).filter((t): t is string => !!t),
      ),
    );
    const tenants = tenantIds.length
      ? await this.tenantRepo.find({ where: { id: In(tenantIds) } })
      : [];
    const nameByTenant = new Map(
      tenants.map((t) => [t.id, t.tenantName ?? t.name ?? null]),
    );
    const admins: ContactRow[] = adminRows.map((a) => ({
      adminId: a.id,
      email: a.email,
      firstName: a.firstName,
      lastName: a.lastName,
      role: a.role as string,
      tenantId: a.tenantId ?? null,
      tenantName: a.tenantId ? nameByTenant.get(a.tenantId) ?? null : null,
    }));
    const adminById = new Map(admins.map((a) => [a.adminId, a]));

    // Unread counts: for each of my conversations, count messages
    // (from others) created after my lastReadMessageId's timestamp.
    const myParts = new Map(mine.map((p) => [p.conversationId, p]));
    const unreadByConv = new Map<string, number>();
    for (const convId of convIds) {
      const part = myParts.get(convId);
      const qb = this.msgRepo
        .createQueryBuilder('m')
        .where('m.conversationId = :id', { id: convId })
        .andWhere('m.senderId != :me', { me: caller.userId });
      if (part?.lastReadMessageId) {
        const lastReadMsg = await this.msgRepo.findOne({
          where: { id: part.lastReadMessageId },
        });
        if (lastReadMsg) {
          qb.andWhere('m.createdAt > :ts', { ts: lastReadMsg.createdAt });
        }
      }
      unreadByConv.set(convId, await qb.getCount());
    }

    const result = convIds
      .map((convId) => {
        const conv = convById.get(convId);
        const peerPart = otherParts.find((p) => p.conversationId === convId);
        const peer = peerPart ? adminById.get(peerPart.adminId) : null;
        if (!conv || !peer) return null;
        return {
          conversationId: convId,
          peer,
          lastMessagePreview: conv.lastMessagePreview,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: unreadByConv.get(convId) ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => {
        const at = a.lastMessageAt?.getTime() ?? 0;
        const bt = b.lastMessageAt?.getTime() ?? 0;
        return bt - at;
      });

    return result;
  }

  /**
   * Get-or-create a 1:1 conversation between the caller and a peer admin.
   * Enforces the permission rules in canChat().
   */
  async startConversation(
    caller: ChatCaller,
    peerAdminId: string,
  ): Promise<Conversation> {
    if (peerAdminId === caller.userId) {
      throw new BadRequestException('Cannot start a conversation with yourself.');
    }
    const peer = await this.adminRepo.findOne({ where: { id: peerAdminId } });
    if (!peer || !peer.isActive) throw new NotFoundException('Peer not found.');
    if (!this.canChat(caller, peer)) {
      throw new ForbiddenException('You are not allowed to chat with this user.');
    }

    // Find existing 1:1 conversation.
    const existing = await this.partRepo
      .createQueryBuilder('p1')
      .innerJoin(
        ConversationParticipant,
        'p2',
        'p2.conversationId = p1.conversationId',
      )
      .where('p1.adminId = :me', { me: caller.userId })
      .andWhere('p2.adminId = :peer', { peer: peerAdminId })
      .select('p1.conversationId', 'conversationId')
      .getRawOne<{ conversationId: string }>();

    if (existing) {
      const conv = await this.convRepo.findOne({
        where: { id: existing.conversationId },
      });
      if (conv) return conv;
    }

    // Create fresh.
    return this.dataSource.transaction(async (manager) => {
      const conv = await manager.getRepository(Conversation).save(
        manager.getRepository(Conversation).create({}),
      );
      const callerAdmin = await this.adminRepo.findOne({
        where: { id: caller.userId },
      });
      await manager.getRepository(ConversationParticipant).save([
        manager.getRepository(ConversationParticipant).create({
          conversationId: conv.id,
          adminId: caller.userId,
          tenantId: callerAdmin?.tenantId ?? null,
        }),
        manager.getRepository(ConversationParticipant).create({
          conversationId: conv.id,
          adminId: peerAdminId,
          tenantId: peer.tenantId ?? null,
        }),
      ]);
      return conv;
    });
  }

  // ─── Messages ────────────────────────────────────────────────────

  private async assertParticipant(caller: ChatCaller, conversationId: string) {
    const ok = await this.partRepo.findOne({
      where: { conversationId, adminId: caller.userId },
    });
    if (!ok) {
      throw new ForbiddenException('You are not a member of this conversation.');
    }
  }

  async listMessages(
    caller: ChatCaller,
    conversationId: string,
    limit = 50,
    beforeId?: string,
  ): Promise<ChatMessage[]> {
    await this.assertParticipant(caller, conversationId);
    let qb = this.msgRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :id', { id: conversationId })
      .orderBy('m.createdAt', 'DESC')
      .take(Math.min(200, Math.max(1, limit)));
    if (beforeId) {
      const before = await this.msgRepo.findOne({ where: { id: beforeId } });
      if (before) {
        qb = qb.andWhere('m.createdAt < :before', { before: before.createdAt });
      }
    }
    const rows = await qb.getMany();
    rows.reverse();

    // Attach a small preview of each replied-to message so the client
    // can render the quoted snippet without an extra round-trip.
    const replyIds = [
      ...new Set(rows.map((r) => r.replyToId).filter(Boolean) as string[]),
    ];
    if (replyIds.length === 0) return rows as ChatMessage[];
    const targets = await this.msgRepo.find({ where: { id: In(replyIds) } });
    const byId = new Map(targets.map((t) => [t.id, t]));
    return rows.map((r) => {
      if (!r.replyToId) return r;
      const t = byId.get(r.replyToId);
      return Object.assign(r, {
        replyTo: t
          ? {
              id: t.id,
              senderId: t.senderId,
              body: t.body,
              attachmentName: t.attachmentName,
            }
          : null,
      });
    }) as ChatMessage[];
  }

  /** Tenant whose Azure storage holds chat blobs for this conversation. */
  private async resolveStorageTenant(
    caller: ChatCaller,
    conversationId: string,
  ): Promise<string> {
    if (caller.tenantId) return caller.tenantId;
    const peers = await this.partRepo.find({ where: { conversationId } });
    for (const p of peers) {
      if (p.tenantId) return p.tenantId;
    }
    throw new BadRequestException(
      'No tenant storage is available for this conversation.',
    );
  }

  async uploadAttachment(
    caller: ChatCaller,
    conversationId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<MessageAttachment> {
    await this.assertParticipant(caller, conversationId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided.');
    }
    const tenantId = await this.resolveStorageTenant(caller, conversationId);
    const { url } = await this.storage.uploadFile({
      tenantId,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      folder: 'chat',
    });
    return {
      url,
      name: file.originalname || 'file',
      mime: file.mimetype || 'application/octet-stream',
      size: file.size ?? file.buffer.length,
    };
  }

  async sendMessage(
    caller: ChatCaller,
    conversationId: string,
    input: {
      body?: string;
      replyToId?: string | null;
      attachment?: MessageAttachment | null;
    },
  ): Promise<ChatMessage> {
    const text = (input.body ?? '').trim();
    const att = input.attachment ?? null;
    if (!text && !att) {
      throw new BadRequestException('A message or an attachment is required.');
    }
    if (text.length > 4000) {
      throw new BadRequestException('Message too long (max 4000 chars).');
    }
    await this.assertParticipant(caller, conversationId);

    if (input.replyToId) {
      const target = await this.msgRepo.findOne({
        where: { id: input.replyToId },
      });
      if (!target || target.conversationId !== conversationId) {
        throw new BadRequestException(
          'The quoted message is not part of this conversation.',
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const msg = await manager.getRepository(ChatMessage).save(
        manager.getRepository(ChatMessage).create({
          conversationId,
          senderId: caller.userId,
          body: text,
          replyToId: input.replyToId ?? null,
          attachmentUrl: att?.url ?? null,
          attachmentName: att?.name ?? null,
          attachmentMime: att?.mime ?? null,
          attachmentSize: att?.size ?? null,
        }),
      );
      const preview = text
        ? text.slice(0, 200)
        : `📎 ${att?.name ?? 'Attachment'}`;
      await manager.getRepository(Conversation).update(
        { id: conversationId },
        { lastMessagePreview: preview, lastMessageAt: msg.createdAt },
      );
      return msg;
    });
  }

  async markRead(
    caller: ChatCaller,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.assertParticipant(caller, conversationId);
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg || msg.conversationId !== conversationId) {
      throw new NotFoundException('Message not found in this conversation.');
    }
    await this.partRepo.update(
      { conversationId, adminId: caller.userId },
      { lastReadMessageId: messageId },
    );
  }

  /** Single number for the navbar badge. */
  async unreadTotal(caller: ChatCaller): Promise<number> {
    const list = await this.listMyConversations(caller);
    return list.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  }
}
