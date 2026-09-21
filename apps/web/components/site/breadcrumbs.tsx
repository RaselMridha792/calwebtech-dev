import { breadcrumbListJsonLd, type Crumb } from '@/lib/seo/json-ld';
import { JsonLd } from '../seo/json-ld';
import type { Ground } from './section';

/**
 * The trail from Home to this page, on every site page (not the homepage or campaign
 * pages), with its BreadcrumbList node. Pass the crumbs after Home; the last is the
 * current page and is not a link.
 */
export function Breadcrumbs({
  crumbs,
  ground = 'light',
  className = '',
}: {
  crumbs: readonly Crumb[];
  ground?: Ground;
  className?: string;
}) {
  const trail: Crumb[] = [{ name: 'Home', path: '/' }, ...crumbs];
  const dark = ground === 'dark';
  return (
    <>
      <nav aria-label="Breadcrumb" className={`text-[13.5px] ${dark ? 'text-ink-invert-muted' : 'text-ink-muted'} ${className}`}>
        <ol className="flex flex-wrap items-center gap-x-2">
          {trail.map((crumb, index) => (
            <li key={crumb.path} className="flex items-center gap-2">
              {index > 0 ? (
                <span className={dark ? 'text-ink-invert-muted' : 'text-ink-muted/60'} aria-hidden="true">
                  /
                </span>
              ) : null}
              {index === trail.length - 1 ? (
                <span aria-current="page" className={`inline-block py-1 font-medium ${dark ? 'text-ink-invert' : 'text-ink'}`}>
                  {crumb.name}
                </span>
              ) : (
                <a
                  href={crumb.path}
                  className={`inline-block py-1 underline-offset-4 hover:underline ${dark ? 'hover:text-ink-invert' : 'hover:text-ink'}`}
                >
                  {crumb.name}
                </a>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbListJsonLd(trail)} />
    </>
  );
}
