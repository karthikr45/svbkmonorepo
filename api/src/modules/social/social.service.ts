import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { SocialPost, SocialPostKind } from './entities/social-post.entity';
import { SocialPostImage } from './entities/social-post-image.entity';
import {
  CreateSocialPostDto,
  UpdateSocialPostDto,
} from './dto/social.dto';
import { Admin } from '../admins/entities/admin.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

export interface SocialAuthor {
  adminId: string;
  email?: string | null;
  name?: string | null;
}

export interface FeedItem extends SocialPost {
  images: SocialPostImage[];
  tenantName: string | null;
}

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(SocialPost)
    private readonly postRepo: Repository<SocialPost>,
    @InjectRepository(SocialPostImage)
    private readonly imageRepo: Repository<SocialPostImage>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ─── Authoring (admin only, scoped to caller's tenant) ──────────

  async create(
    tenantId: string,
    actor: SocialAuthor,
    dto: CreateSocialPostDto,
  ): Promise<FeedItem> {
    const authorName =
      actor.name ??
      (await this.adminRepo
        .findOne({ where: { id: actor.adminId } })
        .then((a) => (a ? `${a.firstName} ${a.lastName}`.trim() : null)));

    return this.dataSource.transaction(async (m) => {
      const post = await m.getRepository(SocialPost).save(
        m.getRepository(SocialPost).create({
          tenantId,
          authorAdminId: actor.adminId,
          authorName,
          kind: dto.kind ?? SocialPostKind.POST,
          title: dto.title.trim(),
          excerpt: dto.excerpt?.trim() || null,
          body: dto.body ?? '',
          eventAt: dto.eventAt ? new Date(dto.eventAt) : null,
          location: dto.location?.trim() || null,
          tags: dto.tags?.trim() || null,
          isPublic: dto.isPublic ?? true,
          isPublished: dto.isPublished ?? true,
        }),
      );
      if (dto.images?.length) {
        await m.getRepository(SocialPostImage).save(
          dto.images.map((img, i) =>
            m.getRepository(SocialPostImage).create({
              postId: post.id,
              url: img.url,
              alt: img.alt ?? null,
              order: i,
            }),
          ),
        );
      }
      return this.composeFeedItem(post);
    });
  }

  async update(
    tenantId: string,
    postId: string,
    dto: UpdateSocialPostDto,
  ): Promise<FeedItem> {
    const post = await this.postRepo.findOne({
      where: { id: postId, tenantId },
    });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);

    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.kind !== undefined) post.kind = dto.kind;
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt?.trim() || null;
    if (dto.body !== undefined) post.body = dto.body ?? '';
    if (dto.eventAt !== undefined) {
      post.eventAt = dto.eventAt ? new Date(dto.eventAt) : null;
    }
    if (dto.location !== undefined) post.location = dto.location?.trim() || null;
    if (dto.tags !== undefined) post.tags = dto.tags?.trim() || null;
    if (dto.isPublic !== undefined) post.isPublic = dto.isPublic;
    if (dto.isPublished !== undefined) post.isPublished = dto.isPublished;

    return this.dataSource.transaction(async (m) => {
      await m.getRepository(SocialPost).save(post);

      if (dto.images !== undefined) {
        // Replace strategy — simple and predictable for the editor.
        await m.getRepository(SocialPostImage).delete({ postId });
        if (dto.images.length) {
          await m.getRepository(SocialPostImage).save(
            dto.images.map((img, i) =>
              m.getRepository(SocialPostImage).create({
                postId,
                url: img.url,
                alt: img.alt ?? null,
                order: i,
              }),
            ),
          );
        }
      }
      return this.composeFeedItem(post);
    });
  }

  async remove(tenantId: string, postId: string): Promise<void> {
    const post = await this.postRepo.findOne({
      where: { id: postId, tenantId },
    });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(SocialPostImage).delete({ postId });
      await m.getRepository(SocialPost).remove(post);
    });
  }

  // ─── Reads ───────────────────────────────────────────────────────

  /** Admin feed — every post in their tenant (drafts included). */
  async tenantFeed(
    tenantId: string,
    opts: { limit?: number; kind?: SocialPostKind } = {},
  ): Promise<FeedItem[]> {
    const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
    const where: any = { tenantId };
    if (opts.kind) where.kind = opts.kind;
    const posts = await this.postRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.attachExtras(posts);
  }

  /** Logged-in feed — published posts in caller's tenant. */
  async myFeed(tenantId: string, opts: { limit?: number } = {}): Promise<FeedItem[]> {
    const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
    const posts = await this.postRepo.find({
      where: { tenantId, isPublished: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.attachExtras(posts);
  }

  /**
   * Public feed — every published, public post across every tenant.
   * Used by the marketing landing / pre-login feed.
   */
  async publicFeed(
    opts: { limit?: number; tenantCode?: string } = {},
  ): Promise<FeedItem[]> {
    const limit = Math.min(60, Math.max(1, opts.limit ?? 20));
    let tenantIdFilter: string | null = null;
    if (opts.tenantCode) {
      const t = await this.tenantRepo.findOne({
        where: { tenantCode: opts.tenantCode.trim() },
      });
      if (!t) throw new NotFoundException('Tenant not found');
      tenantIdFilter = t.id;
    }
    const where: any = { isPublished: true, isPublic: true };
    if (tenantIdFilter) where.tenantId = tenantIdFilter;
    const posts = await this.postRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.attachExtras(posts);
  }

  async findOnePublic(postId: string): Promise<FeedItem> {
    const post = await this.postRepo.findOne({
      where: { id: postId, isPublished: true, isPublic: true },
    });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    return this.composeFeedItem(post);
  }

  async findOneScoped(tenantId: string, postId: string): Promise<FeedItem> {
    const post = await this.postRepo.findOne({ where: { id: postId, tenantId } });
    if (!post) throw new NotFoundException(`Post ${postId} not found`);
    return this.composeFeedItem(post);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private async attachExtras(posts: SocialPost[]): Promise<FeedItem[]> {
    if (posts.length === 0) return [];
    const ids = posts.map((p) => p.id);
    const images = await this.imageRepo.find({
      where: { postId: In(ids) },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
    const tenantIds = Array.from(new Set(posts.map((p) => p.tenantId)));
    const tenants = await this.tenantRepo.find({
      where: { id: In(tenantIds) },
    });
    const nameByTenant = new Map(
      tenants.map((t) => [t.id, t.tenantName ?? t.name ?? null]),
    );

    return posts.map((p) => ({
      ...p,
      images: images.filter((i) => i.postId === p.id),
      tenantName: nameByTenant.get(p.tenantId) ?? null,
    }));
  }

  private async composeFeedItem(post: SocialPost): Promise<FeedItem> {
    const images = await this.imageRepo.find({
      where: { postId: post.id },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
    const tenant = await this.tenantRepo.findOne({ where: { id: post.tenantId } });
    return {
      ...post,
      images,
      tenantName: tenant?.tenantName ?? tenant?.name ?? null,
    };
  }
}
