import { del, get, patch, post } from "@/lib/api-client";

export type SocialPostKind = "POST" | "EVENT" | "ANNOUNCEMENT";

export interface SocialImage {
  id?: string;
  url: string;
  alt?: string | null;
  order?: number;
}

export interface SocialPost {
  id: string;
  tenantId: string;
  authorAdminId: string | null;
  authorName: string | null;
  kind: SocialPostKind;
  title: string;
  excerpt: string | null;
  body: string;
  eventAt: string | null;
  location: string | null;
  tags: string | null;
  isPublic: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  images: SocialImage[];
  tenantName: string | null;
}

export interface UpsertSocialPostBody {
  title: string;
  kind: SocialPostKind;
  excerpt?: string;
  body?: string;
  eventAt?: string | null;
  location?: string;
  tags?: string;
  isPublic: boolean;
  isPublished: boolean;
  images?: { url: string; alt?: string }[];
}

function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

export async function listAdminPostsApi(opts: {
  limit?: number;
  kind?: SocialPostKind;
} = {}): Promise<SocialPost[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.kind) params.set("kind", opts.kind);
  const qs = params.toString();
  return unwrap<SocialPost[]>(await get(`/social/manage${qs ? `?${qs}` : ""}`));
}

export async function listFeedApi(opts: { limit?: number } = {}): Promise<SocialPost[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return unwrap<SocialPost[]>(await get(`/social/feed${qs ? `?${qs}` : ""}`));
}

export async function listPublicFeedApi(opts: {
  limit?: number;
  tenantCode?: string;
} = {}): Promise<SocialPost[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.tenantCode) params.set("tenantCode", opts.tenantCode);
  const qs = params.toString();
  return unwrap<SocialPost[]>(
    await get(`/social/public/feed${qs ? `?${qs}` : ""}`),
  );
}

export async function getPostApi(id: string): Promise<SocialPost> {
  return unwrap<SocialPost>(await get(`/social/${id}`));
}

export async function getPublicPostApi(id: string): Promise<SocialPost> {
  return unwrap<SocialPost>(await get(`/social/public/posts/${id}`));
}

export async function createPostApi(body: UpsertSocialPostBody): Promise<SocialPost> {
  return unwrap<SocialPost>(await post("/social", body));
}

export async function updatePostApi(
  id: string,
  body: Partial<UpsertSocialPostBody>,
): Promise<SocialPost> {
  return unwrap<SocialPost>(await patch(`/social/${id}`, body));
}

export async function deletePostApi(id: string): Promise<void> {
  await del(`/social/${id}`);
}
