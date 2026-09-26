import type { CompanyTechnologyGroup } from '@calwebtech/shared';
import { reveal } from '@/components/ui/primitives';
import { ResponsiveImage } from '@/components/ui/responsive-image';

/** Technologies grouped by the part of the platform they run, each with how we use it. */
export function TechnologyGroups({ groups }: { groups: readonly CompanyTechnologyGroup[] }) {
  return (
    <ul data-company-list="technology" className="grid gap-6 lg:grid-cols-2">
      {groups.map((group, index) => (
        // Each part is an address — /technology/#frontend and the rest — because the Resources
        // menu links straight to it. The margin keeps the fixed header off its heading.
        <li
          key={group.key}
          id={group.key}
          className="scroll-mt-28 border border-hairline bg-canvas-raised p-7 lg:p-8"
          {...reveal(index)}
        >
          <h3 className="font-display text-[22px] font-extrabold text-ink">{group.label}</h3>
          {group.summary ? <p className="mt-2 text-[15.5px] leading-relaxed">{group.summary}</p> : null}
          <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
            {group.technologies.map((technology) => (
              <li key={technology.slug} data-technology="" className="flex gap-4 py-4">
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
                  <p className="font-display text-[16.5px] font-bold text-ink">{technology.name}</p>
                  {technology.proficiencyNote ? (
                    <p className="mt-1 text-[15px] leading-relaxed">{technology.proficiencyNote}</p>
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
