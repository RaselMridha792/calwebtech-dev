import { PAGE_COPY_SCHEMAS, SETTING_KEYS, STATIC_SETTING_KEYS, type PageCopyKey } from '@calwebtech/shared';
import {
  Controller,
  Get,
  Injectable,
  InternalServerErrorException,
  Logger,
  Module,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Page copy stored in the database, for a site that renders its pages from the snapshots
 * (docs/08-decisions.md, 59). With `home` or `thank-you` in `CONTENT_DATABASE_FIRST`, the web
 * app lays this copy over the snapshot's records, so a change made in the dashboard is live
 * without a deploy while the records stay where they are.
 *
 * Only the copy the web app lays over a snapshot is served here; the index copy of the
 * services, industries and work families reaches the site through those families' own views.
 */
const SERVED = [SETTING_KEYS.homeContent, STATIC_SETTING_KEYS.thankYou] as const satisfies readonly PageCopyKey[];
type ServedKey = (typeof SERVED)[number];

/** As long as the other views: an edit is live within half a minute. */
export const PAGE_COPY_TTL_MS = 30_000;

@Injectable()
export class PageCopyService {
  private readonly logger = new Logger(PageCopyService.name);
  private readonly cache = new ViewCache<unknown>(PAGE_COPY_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  /** The stored copy, or null when none is stored. Stored copy the page would refuse is a 500. */
  find(key: ServedKey): Promise<unknown> {
    return this.cache.get(key, async () => {
      const row = await this.prisma.client.setting.findUnique({ where: { key } });
      if (!row) return null;
      const parsed = PAGE_COPY_SCHEMAS[key].safeParse(row.value);
      if (!parsed.success) {
        this.logger.error(`The "${key}" setting failed contract validation.`, parsed.error);
        throw new InternalServerErrorException();
      }
      return parsed.data;
    });
  }
}

@Controller('pages/copy')
export class PageCopyController {
  constructor(private readonly copy: PageCopyService) {}

  /** Not rate limited, like every view the web server asks for on each render. */
  @Get(':key')
  @SkipThrottle()
  async find(@Param('key') key: string): Promise<unknown> {
    if (!isServed(key)) throw new NotFoundException();
    const value = await this.copy.find(key);
    if (value === null) throw new NotFoundException();
    return value;
  }
}

function isServed(key: string): key is ServedKey {
  return (SERVED as readonly string[]).includes(key);
}

@Module({ controllers: [PageCopyController], providers: [PageCopyService] })
export class PageCopyModule {}
