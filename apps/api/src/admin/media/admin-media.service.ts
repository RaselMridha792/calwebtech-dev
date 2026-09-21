import {
  MEDIA_ERRORS,
  MEDIA_MAX_BYTES,
  MEDIA_MIME_TYPES,
  mediaVariantSchema,
  type AdminMediaAsset,
  type AdminMediaList,
  type AdminMediaQuery,
  type MediaUsage,
} from '@calwebtech/shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from '../leads/admin-leads.service';
import { removeUpload, storeUpload } from './media-storage';

/**
 * The media library (docs/12-admin-dashboard.md, module 7).
 *
 * Alt text is required at upload, which is the only moment anyone knows what the image was
 * for. Deleting is refused while something still points at the asset, because the
 * alternative is a page with a broken image and no trace of what it was.
 */

/**
 * Where a media path can appear. Adding a column that holds one means adding it here, or a
 * delete will not see it — which is why this is a list rather than a query per table
 * scattered through the service.
 */
const USAGE_SOURCES: { table: string; label: string; entity: string; columns: string[]; json: string[] }[] = [
  { table: 'Service', label: 'title', entity: 'Service', columns: ['icon', 'heroMediaUrl'], json: ['content'] },
  { table: 'Industry', label: 'name', entity: 'Industry', columns: [], json: ['content'] },
  { table: 'Location', label: 'city', entity: 'Location', columns: [], json: ['content'] },
  { table: 'Project', label: 'title', entity: 'Case study', columns: ['coverImage'], json: ['gallery'] },
  { table: 'Post', label: 'title', entity: 'Article', columns: ['coverImage'], json: [] },
  { table: 'Guide', label: 'title', entity: 'Guide', columns: ['coverImage'], json: [] },
  { table: 'TeamMember', label: 'name', entity: 'Team member', columns: ['photo'], json: [] },
  { table: 'Demo', label: 'title', entity: 'Demo', columns: ['thumbnail'], json: [] },
  { table: 'PageSection', label: 'sectionKey', entity: 'Page section', columns: ['mediaUrl'], json: [] },
  { table: 'LandingPage', label: 'name', entity: 'Campaign page', columns: [], json: ['content'] },
];

@Injectable()
export class AdminMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminMediaQuery): Promise<AdminMediaList> {
    const where = {
      deletedAt: null,
      ...(query.search ? { altText: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.mediaAsset.count({ where }),
    ]);

    const uploaders = await this.uploaders(rows.map((row) => row.uploadedBy));
    return {
      items: rows.map((row) => toAsset(row, uploaders, [])),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** One asset with the records that point at it, which is what makes a delete decidable. */
  async detail(id: string): Promise<AdminMediaAsset | null> {
    const row = await this.prisma.client.mediaAsset.findFirst({ where: { id, deletedAt: null } });
    if (!row) return null;
    const uploaders = await this.uploaders([row.uploadedBy]);
    return toAsset(row, uploaders, await this.usageOf(row.url, row.id));
  }

  /**
   * Accepts the file, refuses everything about it that is wrong before a byte is written:
   * no alt text, a type the library does not take, a size past the limit, or a file that is
   * not an image whatever its declared type said.
   */
  async upload(
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    altText: string,
    actor: Actor,
  ): Promise<AdminMediaAsset> {
    const alt = altText.trim();
    if (alt.length === 0) {
      throw new BadRequestException({
        error: MEDIA_ERRORS.missingAlt,
        message: 'Describe the image before uploading it. Alt text cannot be added later by someone who was not here.',
      });
    }
    if (!MEDIA_MIME_TYPES.includes(file.mimetype as (typeof MEDIA_MIME_TYPES)[number])) {
      throw new BadRequestException({
        error: MEDIA_ERRORS.badType,
        message: `The library takes ${MEDIA_MIME_TYPES.join(', ')}. That file is ${file.mimetype}.`,
      });
    }
    if (file.size > MEDIA_MAX_BYTES) {
      throw new BadRequestException({
        error: MEDIA_ERRORS.tooLarge,
        message: `That file is larger than ${String(Math.round(MEDIA_MAX_BYTES / 1024 / 1024))} MB.`,
      });
    }

    // The row is created first so the id names the directory, and removed again if the
    // encoding fails — a half-written directory with no row would be invisible for ever.
    const row = await this.prisma.client.mediaAsset.create({
      data: { url: '', altText: alt, mimeType: file.mimetype, sizeBytes: file.size, uploadedBy: actor.id },
    });

    try {
      const stored = await storeUpload(row.id, file.buffer, file.mimetype);
      const updated = await this.prisma.client.mediaAsset.update({
        where: { id: row.id },
        data: {
          url: stored.url,
          width: stored.width,
          height: stored.height,
          variants: stored.variants,
        },
      });
      await this.audit.record({
        userId: actor.id,
        action: 'media.uploaded',
        entityType: 'MediaAsset',
        entityId: row.id,
        after: { altText: alt, mimeType: file.mimetype, sizeBytes: file.size, filename: file.originalname },
        ip: actor.ip,
      });
      const uploaders = await this.uploaders([updated.uploadedBy]);
      return toAsset(updated, uploaders, []);
    } catch (cause) {
      await this.prisma.client.mediaAsset.delete({ where: { id: row.id } });
      await removeUpload(row.id);
      throw new BadRequestException({
        error: MEDIA_ERRORS.notAnImage,
        message: 'That file could not be read as an image. It may be truncated or misnamed.',
        detail: cause instanceof Error ? cause.message : undefined,
      });
    }
  }

  /** The one thing about an asset that can be corrected afterwards. */
  async updateAlt(id: string, altText: string, actor: Actor): Promise<AdminMediaAsset> {
    const row = await this.prisma.client.mediaAsset.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException();

    await this.prisma.client.mediaAsset.update({ where: { id }, data: { altText } });
    await this.audit.record({
      userId: actor.id,
      action: 'media.alt_changed',
      entityType: 'MediaAsset',
      entityId: id,
      before: { altText: row.altText },
      after: { altText },
      ip: actor.ip,
    });
    const detail = await this.detail(id);
    if (!detail) throw new NotFoundException();
    return detail;
  }

  /**
   * Soft-deletes the row and removes the files, but only once nothing points at the asset.
   * The row stays so an audit entry naming it still resolves.
   */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    const row = await this.prisma.client.mediaAsset.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException();

    const usage = await this.usageOf(row.url, row.id);
    if (usage.length > 0) {
      throw new ConflictException({
        error: MEDIA_ERRORS.inUse,
        message: `Still used by ${String(usage.length)} ${usage.length === 1 ? 'record' : 'records'}. Replace it there first.`,
        usage,
      });
    }

    await this.prisma.client.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } });
    await removeUpload(id);
    await this.audit.record({
      userId: actor.id,
      action: 'media.deleted',
      entityType: 'MediaAsset',
      entityId: id,
      before: { url: row.url, altText: row.altText },
      ip: actor.ip,
    });
    return { deleted: true };
  }

  /**
   * Every record that names this asset, by its public path or by its id inside a content
   * blob. The JSON columns are searched as text: a path can sit at any depth in them, and a
   * typed query would have to know every shape the families use.
   */
  private async usageOf(url: string, id: string): Promise<MediaUsage[]> {
    if (!url) return [];
    const needle = `%${id}%`;
    const found: MediaUsage[] = [];

    for (const source of USAGE_SOURCES) {
      const tests = [
        ...source.columns.map((column) => `"${column}" = $1`),
        ...source.json.map((column) => `"${column}"::text LIKE $2`),
      ];
      if (tests.length === 0) continue;
      const sql = `SELECT id, "${source.label}"::text AS label FROM "${source.table}" WHERE ${tests.join(' OR ')} LIMIT 20`;
      const rows = await this.prisma.client.$queryRawUnsafe<{ id: string; label: string | null }[]>(sql, url, needle);
      for (const row of rows) {
        found.push({ entityType: source.entity, entityId: row.id, label: row.label ?? row.id });
      }
    }
    return found;
  }

  /** Names for the ids on the rows, in one query rather than one per asset. */
  private async uploaders(ids: (string | null)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (wanted.length === 0) return new Map();
    const users = await this.prisma.client.user.findMany({
      where: { id: { in: wanted } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }
}

function toAsset(
  row: {
    id: string;
    url: string;
    altText: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    sizeBytes: number | null;
    variants: unknown;
    uploadedBy: string | null;
    createdAt: Date;
  },
  uploaders: Map<string, string>,
  usage: MediaUsage[],
): AdminMediaAsset {
  const parsed = mediaVariantSchema.array().safeParse(row.variants ?? []);
  return {
    id: row.id,
    url: row.url,
    altText: row.altText,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    // A row whose variants cannot be read still lists: the original is always serveable,
    // and hiding the asset would only make the bad row harder to find.
    variants: parsed.success ? parsed.data : [],
    uploadedBy: row.uploadedBy ? { id: row.uploadedBy, name: uploaders.get(row.uploadedBy) ?? 'A removed account' } : null,
    createdAt: row.createdAt.toISOString(),
    usage,
  };
}
