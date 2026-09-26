import type { CompanyTechnologyGroup } from '@calwebtech/shared';
import { reveal } from '@/components/ui/primitives';
import { ResponsiveImage } from '@/components/ui/responsive-image';

/**
 * Technologies grouped by the part of the platform they run, each with how we use it. A group
 * opens on a heavy ink rule with its number, not in a box; its technologies are rows on
 * hairlines that warm under the pointer.
 */
export function TechnologyGroups({ groups }: { groups: readonly CompanyTechnologyGroup[] }) {
  return (
    <ul data-company-list="technology" className="grid gap-x-12 gap-y-14 lg:grid-cols-2">
      {groups.map((group, index) => (
        // Each part is an address — /technology/#frontend and the rest — because the Resources
        // menu links straight to it. The margin keeps the fixed header off its heading.
        <li
          key={group.key}
          id={group.key}
          className="scroll-mt-28 border-t-2 border-ink pt-6"
          {...reveal(index)}
        >
          <span className="meta text-ink-muted">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="display-md mt-3 text-ink">{group.label}</h3>
          {group.summary ? <p className="body-base mt-3 text-ink-muted">{group.summary}</p> : null}
          <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
            {group.technologies.map((technology) => (
              <li
                key={technology.slug}
                data-technology=""
                className="flex gap-4 px-2 py-4 transition-colors duration-200 hover:bg-canvas-raised"
              >
                {technology.logo ? (
                  <ResponsiveImage
                    src={technology.logo.src}
                    alt={technology.logo.alt}
                    width={32}
                    height={32}
                    sizes="32px"
                    className="mt-0.5 h-8 w-8 shrink-0 object-contain"
                  />
                ) : null}
                <div>
                  <p className="heading-sm text-ink">{technology.name}</p>
                  {technology.proficiencyNote ? (
                    <p className="body-sm mt-1 text-ink-muted">{technology.proficiencyNote}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
