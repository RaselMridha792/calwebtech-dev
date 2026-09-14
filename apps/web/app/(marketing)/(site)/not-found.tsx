import { NotFoundPage } from '@/components/static/not-found';
import { getStaticNotFound } from '@/lib/api/static';

/**
 * A site page called `notFound()` (an unknown slug): the designed 404 inside the site layout,
 * so the header, footer and closing band stay. Copy is the `static.not-found` setting.
 */
export default async function SiteNotFound() {
  const view = await getStaticNotFound();
  return <NotFoundPage view={view} />;
}
