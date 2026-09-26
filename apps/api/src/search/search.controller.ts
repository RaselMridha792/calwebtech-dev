import { Prisma } from '@calwebtech/db';
import {
  SITE_ROUTES,
  caseStudyPath,
  glossaryTermPath,
  insightsArticlePath,
  searchQuerySchema,
  searchResults,
  servicePath,
  type SearchQuery,
  type SearchResult,
  type SearchResults,
  type SearchType,
} from '@calwebtech/shared';
import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ViewCache } from '../common/view-cache';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { caseStudyReadiness } from '../work/work.mapper';

/**
 * Site search in Postgres (docs/06-build-plan.md, task 4.3; docs/08-decisions.md, 62): its own
 * full-text engine across services, case studies, insights, glossary terms and questions, with
 * no search vendor. A title counts more than the words under it, and `websearch_to_tsquery`
 * reads a query the way people type one: quoted phrases, `or`, a leading minus.
 *
 * Only what is published and has a page is found: a service or post live by status and time, a
 * case study with the figures its page needs, a glossary term published, and a question on the
 * FAQ page or on a live service, industry or location page. The tables are small enough to
 * need no index; `docs/08` says when that would change.
 */

interface Row {
  type: SearchType;
  slug: string;
  title: string;
  summary: string;
  href: string | null;
  metrics: Prisma.JsonValue | null;
  answer: string | null;
}

/** Most matches read before filtering; far more than a page shows. */
const MATCH_LIMIT = 200;

/** A result's line under its title, cut at a word. */
function line(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:.–-]+$/u, '')}…`;
}

function hrefOf(row: Row): string {
  switch (row.type) {
    case 'service':
      return servicePath(row.slug);
    case 'case-study':
      return caseStudyPath(row.slug);
    case 'insight':
      return insightsArticlePath(row.slug);
    case 'glossary':
      return glossaryTermPath(row.slug);
    case 'faq':
      return row.href ?? SITE_ROUTES.faq;
  }
}

@Injectable()
export class SearchService {
  /** Half a minute, as long as a page view: the same query from many visitors is one query. */
  private readonly cache = new ViewCache<SearchResult[]>(30_000);

  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQuery): Promise<SearchResults> {
    const matches = await this.cache.get(query.q.toLowerCase(), () => this.match(query.q));
    return searchResults(query.q, query.type ?? null, matches);
  }

  private async match(q: string): Promise<SearchResult[]> {
    const rows = await this.prisma.client.$queryRaw<Row[]>(Prisma.sql`
      WITH q AS (SELECT websearch_to_tsquery('english', ${q}) AS query)
      SELECT type, slug, title, summary, href, metrics, answer FROM (
        SELECT 'service' AS type, s.slug, s.title, s."shortDescription" AS summary, NULL AS href,
               NULL::jsonb AS metrics, NULL AS answer,
               ts_rank(setweight(to_tsvector('english', s.title), 'A')
                    || setweight(to_tsvector('english', s."shortDescription" || ' ' || s."answerBlock"), 'B'), q.query) AS rank
        FROM "Service" s, q
        WHERE s."deletedAt" IS NULL
          AND (s.status = 'PUBLISHED' OR (s.status = 'SCHEDULED' AND s."publishedAt" <= now()))
          AND (setweight(to_tsvector('english', s.title), 'A')
            || setweight(to_tsvector('english', s."shortDescription" || ' ' || s."answerBlock"), 'B')) @@ q.query
        UNION ALL
        SELECT 'case-study', p.slug, COALESCE(p."clientAlias", p."clientName"), p.summary, NULL,
               p."outcomeMetrics", p."answerBlock",
               ts_rank(setweight(to_tsvector('english', p.title || ' ' || COALESCE(p."clientAlias", p."clientName")), 'A')
                    || setweight(to_tsvector('english', p.summary || ' ' || p."answerBlock"), 'B'), q.query)
        FROM "Project" p, q
        WHERE p."deletedAt" IS NULL AND p.status = 'PUBLISHED'
          AND (setweight(to_tsvector('english', p.title || ' ' || COALESCE(p."clientAlias", p."clientName")), 'A')
            || setweight(to_tsvector('english', p.summary || ' ' || p."answerBlock"), 'B')) @@ q.query
        UNION ALL
        SELECT 'insight', po.slug, po.title, po.excerpt, NULL, NULL::jsonb, NULL,
               ts_rank(setweight(to_tsvector('english', po.title), 'A')
                    || setweight(to_tsvector('english', po.excerpt || ' ' || po."answerBlock"), 'B'), q.query)
        FROM "Post" po, q
        WHERE (po.status = 'PUBLISHED' OR (po.status = 'SCHEDULED' AND po."publishedAt" <= now()))
          AND (setweight(to_tsvector('english', po.title), 'A')
            || setweight(to_tsvector('english', po.excerpt || ' ' || po."answerBlock"), 'B')) @@ q.query
        UNION ALL
        SELECT 'glossary', g.slug, g.term, g."shortDefinition", NULL, NULL::jsonb, NULL,
               ts_rank(setweight(to_tsvector('english', g.term), 'A')
                    || setweight(to_tsvector('english', g."shortDefinition" || ' ' || g.body), 'B'), q.query)
        FROM "GlossaryTerm" g, q
        WHERE g.status = 'PUBLISHED'
          AND (setweight(to_tsvector('english', g.term), 'A')
            || setweight(to_tsvector('english', g."shortDefinition" || ' ' || g.body), 'B')) @@ q.query
        UNION ALL
        SELECT 'faq', f.id, f.question, f.answer,
               CASE
                 WHEN f."serviceId" IS NOT NULL THEN '/services/' || s.slug || '/'
                 WHEN f."industryId" IS NOT NULL THEN '/industries/' || i.slug || '/'
                 WHEN f."locationId" IS NOT NULL THEN '/locations/' || l.slug || '/'
                 ELSE '/faq/'
               END,
               NULL::jsonb, NULL,
               ts_rank(setweight(to_tsvector('english', f.question), 'A')
                    || setweight(to_tsvector('english', f.answer), 'B'), q.query)
        FROM "Faq" f
        CROSS JOIN q
        LEFT JOIN "Service" s ON s.id = f."serviceId"
        LEFT JOIN "Industry" i ON i.id = f."industryId"
        LEFT JOIN "Location" l ON l.id = f."locationId"
        WHERE f."landingPageId" IS NULL
          AND (
            (f."serviceId" IS NULL AND f."industryId" IS NULL AND f."locationId" IS NULL AND f."group" IS NOT NULL)
            OR (s.id IS NOT NULL AND s."deletedAt" IS NULL
                AND (s.status = 'PUBLISHED' OR (s.status = 'SCHEDULED' AND s."publishedAt" <= now())))
            OR (i.id IS NOT NULL AND i."deletedAt" IS NULL AND i.status = 'PUBLISHED')
            OR (l.id IS NOT NULL AND l.status = 'PUBLISHED')
          )
          AND (setweight(to_tsvector('english', f.question), 'A')
            || setweight(to_tsvector('english', f.answer), 'B')) @@ q.query
      ) AS matches
      ORDER BY rank DESC, title ASC
      LIMIT ${MATCH_LIMIT}
    `);

    // A case study without the figures its page needs has no page to find.
    const hasPage = (row: Row): boolean =>
      row.type !== 'case-study' || caseStudyReadiness({ outcomeMetrics: row.metrics, answerBlock: row.answer ?? '' }).ready;
    return rows
      .filter(hasPage)
      .map((row) => ({ type: row.type, title: row.title, summary: line(row.summary), href: hrefOf(row) }));
  }
}

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /**
   * `GET /search?q=&type=`. Not rate limited, like the page views: the web server asks on each
   * visitor's behalf from one address, and repeated queries are served from the short cache.
   */
  @Get()
  @SkipThrottle()
  find(@Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery): Promise<SearchResults> {
    return this.search.search(query);
  }
}

@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
