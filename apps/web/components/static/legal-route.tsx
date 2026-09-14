import type { StaticLegalSlug } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { getStaticLegal } from '@/lib/api/static';
import { sitePageMetadata } from '@/lib/seo/page-metadata';
import { LegalPage } from './legal';

const legalPath = (slug: StaticLegalSlug): string => `/${slug}/`;

/** Metadata for a page of the legal set, from its stored copy. */
export async function legalPageMetadata(slug: StaticLegalSlug): Promise<Metadata> {
  const page = await getStaticLegal(slug);
  return sitePageMetadata({ ...page.seo, path: legalPath(slug) });
}

/** The body of a legal route: each of the five route files renders this with its slug. */
export async function LegalRoute({ slug }: { slug: StaticLegalSlug }) {
  const page = await getStaticLegal(slug);
  return <LegalPage page={page} path={legalPath(slug)} />;
}
