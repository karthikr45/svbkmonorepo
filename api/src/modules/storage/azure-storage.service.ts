import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { randomBytes } from 'crypto';
import { TenantConfig } from '../tenant-configs/entities/tenant-config.entity';

/**
 * Per-tenant Azure Blob Storage. Reads credentials from the tenant's
 * active TenantConfig — same pattern we use for payment gateway keys.
 *
 * Supports either:
 *  - `storageConnectionString` (preferred — single field, contains
 *    account name + key)
 *  - `accountName + accessKey` (legacy / explicit fields)
 *
 * Container name comes from `storageBucketName` (Azure terminology
 * doesn't quite match S3 but the field is reused). The container is
 * created on first use with public-read access for blobs (school
 * photos are meant to be visible to anyone with the URL).
 */
@Injectable()
export class AzureStorageService {
  private readonly logger = new Logger(AzureStorageService.name);

  constructor(
    @InjectRepository(TenantConfig)
    private readonly tenantConfigRepo: Repository<TenantConfig>,
  ) {}

  /**
   * Returns the most-recent active TenantConfig for the tenant — same
   * resolution as the payment gateway flow.
   */
  private async resolveConfig(tenantId: string): Promise<TenantConfig> {
    const cfg = await this.tenantConfigRepo.findOne({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    if (!cfg) {
      throw new NotFoundException(
        'No active tenant configuration. Set storage credentials under the tenant Configuration tab.',
      );
    }
    return cfg;
  }

  private clientFromConfig(
    cfg: TenantConfig,
  ): { blobService: BlobServiceClient; container: string; baseHost: string } {
    const container = (cfg.storageBucketName ?? '').trim();
    if (!container) {
      throw new BadRequestException(
        'storageBucketName (container name) is not configured for this tenant.',
      );
    }

    // Prefer connection string when present.
    if (cfg.storageConnectionString && cfg.storageConnectionString.trim()) {
      const blobService = BlobServiceClient.fromConnectionString(
        cfg.storageConnectionString.trim(),
      );
      const baseHost = `${blobService.accountName}.blob.core.windows.net`;
      return { blobService, container, baseHost };
    }

    // Fall back to explicit account + access key.
    // We treat `accessKey` as the account access key and
    // `storageSecretKey` as the account NAME (legacy mapping in this
    // schema since there was no dedicated account-name column).
    const accessKey = (cfg.accessKey ?? '').trim();
    const accountName = (cfg.storageSecretKey ?? '').trim();
    if (!accessKey || !accountName) {
      throw new BadRequestException(
        'Storage credentials missing. Provide either a connection string, or both account name + access key for this tenant.',
      );
    }
    const credential = new StorageSharedKeyCredential(accountName, accessKey);
    const blobService = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential,
    );
    return {
      blobService,
      container,
      baseHost: `${accountName}.blob.core.windows.net`,
    };
  }

  /**
   * Upload a single image buffer and return the public URL. The
   * container is created lazily on first call with `blob`-level
   * public access (so the URL is shareable without SAS tokens).
   */
  async uploadImage(args: {
    tenantId: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
    folder?: string;
  }): Promise<{ url: string; key: string }> {
    if (!args.buffer?.length) {
      throw new BadRequestException('Empty upload');
    }
    if (args.buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 10 MB)');
    }
    if (!/^image\//i.test(args.mimeType)) {
      throw new BadRequestException('Only images are accepted on this endpoint');
    }

    const cfg = await this.resolveConfig(args.tenantId);
    const { blobService, container, baseHost } = this.clientFromConfig(cfg);

    const containerClient = blobService.getContainerClient(container);
    try {
      await containerClient.createIfNotExists({ access: 'blob' });
    } catch (err) {
      // Some storage accounts disable public access at the account
      // level; in that case the container exists but createIfNotExists
      // throws when trying to set access. Try without `access`.
      this.logger.warn(
        `createIfNotExists with public access failed for tenant=${args.tenantId}; retrying without public access. ${
          (err as Error).message
        }`,
      );
      await containerClient.createIfNotExists();
    }

    const ext = extOf(args.originalName, args.mimeType);
    const folder = (args.folder ?? 'social').replace(/^\/+|\/+$/g, '');
    const key = `${folder}/${args.tenantId}/${Date.now()}-${randomBytes(8).toString(
      'hex',
    )}${ext}`;

    const blockBlob = containerClient.getBlockBlobClient(key);
    await blockBlob.uploadData(args.buffer, {
      blobHTTPHeaders: {
        blobContentType: args.mimeType,
        blobCacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const url = `https://${baseHost}/${container}/${key}`;
    this.logger.log(`Uploaded ${args.buffer.length}B → ${url}`);
    return { url, key };
  }

  /**
   * Best-effort delete. Doesn't throw on 404 — callers tolerate
   * missing blobs (e.g. when a post that's already been edited gets
   * deleted and the new image set is shorter than the old one).
   */
  async deleteByUrl(tenantId: string, url: string): Promise<void> {
    if (!url) return;
    let cfg: TenantConfig;
    try {
      cfg = await this.resolveConfig(tenantId);
    } catch {
      return;
    }
    const { blobService, container, baseHost } = this.clientFromConfig(cfg);
    const prefix = `https://${baseHost}/${container}/`;
    if (!url.startsWith(prefix)) {
      return; // not our blob, leave it alone
    }
    const key = url.slice(prefix.length);
    try {
      await blobService
        .getContainerClient(container)
        .getBlockBlobClient(key)
        .deleteIfExists();
    } catch (err) {
      this.logger.warn(`delete blob ${key} failed: ${(err as Error).message}`);
    }
  }
}

function extOf(name: string | undefined, mime: string): string {
  if (name) {
    const m = /\.[a-zA-Z0-9]+$/.exec(name);
    if (m) return m[0].toLowerCase();
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/avif') return '.avif';
  return '';
}
