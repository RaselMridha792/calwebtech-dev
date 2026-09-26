import type { CompanyTeamMember } from '@calwebtech/shared';
import { reveal } from '@/components/ui/primitives';
import { ResponsiveImage } from '@/components/ui/responsive-image';

/** Team profiles: photograph, name, role, bio, skills and profile links. */
export function TeamGrid({ members }: { members: readonly CompanyTeamMember[] }) {
  return (
    // Portraits without boxes: the photograph slowly pushes in under the pointer, the name and
    // role under it, skills as one dotted line of meta.
    <ul data-company-list="team" className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {members.map((member, index) => (
        <li
          key={member.slug}
          data-team-member=""
          className="group flex flex-col"
          {...reveal(index)}
        >
          {member.photo ? (
            <div className="relative aspect-[4/5] overflow-hidden bg-canvas-sunken">
              <ResponsiveImage
                src={member.photo.src}
                alt={member.photo.alt}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover grayscale-[35%] transition duration-[1600ms] ease-out-quint group-hover:grayscale-0 motion-safe:group-hover:scale-105"
              />
            </div>
          ) : null}
          <div className="flex flex-1 flex-col pt-5">
            <h3 className="heading-md text-ink">{member.name}</h3>
            <p className="eyebrow mt-1.5 text-gold-ink">{member.role}</p>
            {member.bio ? <p className="body-sm mt-3 text-ink-muted">{member.bio}</p> : null}
            {member.skills.length > 0 ? (
              <ul
                aria-label={`What ${member.name} works on`}
                className="meta mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ink-muted uppercase"
              >
                {member.skills.map((skill, position) => (
                  <li key={skill} className="flex items-center gap-2.5">
                    {position > 0 ? <span aria-hidden className="h-1 w-1 bg-hairline-strong" /> : null}
                    {skill}
                  </li>
                ))}
              </ul>
            ) : null}
            {member.socials.length > 0 ? (
              <ul className="mt-auto flex flex-wrap gap-x-5 pt-5 text-[14.5px]">
                {member.socials.map((social) => (
                  <li key={social.href}>
                    <a href={social.href} rel="me noopener" className="inline-block py-1 font-semibold text-gold-ink hover:text-gold-600">
                      {social.label}
                      <span className="sr-only">{`: ${member.name}`}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
