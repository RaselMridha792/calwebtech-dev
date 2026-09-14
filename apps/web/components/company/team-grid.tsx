import type { CompanyTeamMember } from '@calwebtech/shared';
import { reveal } from '@/components/ui/primitives';
import { ResponsiveImage } from '@/components/ui/responsive-image';

/** Team profiles: photograph, name, role, bio, skills and profile links. */
export function TeamGrid({ members }: { members: readonly CompanyTeamMember[] }) {
  return (
    <ul data-company-list="team" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {members.map((member, index) => (
        <li
          key={member.slug}
          data-team-member=""
          className="lift flex flex-col overflow-hidden rounded-2xl border border-line bg-white"
          {...reveal(index)}
        >
          {member.photo ? (
            <div className="relative aspect-[4/5] bg-mist">
              <ResponsiveImage
                src={member.photo.src}
                alt={member.photo.alt}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}
          <div className="flex flex-1 flex-col p-6">
            <h3 className="font-display text-[19px] font-bold text-ink">{member.name}</h3>
            <p className="text-[14.5px] font-semibold text-primary">{member.role}</p>
            {member.bio ? <p className="mt-3 text-[15px] leading-relaxed">{member.bio}</p> : null}
            {member.skills.length > 0 ? (
              <ul aria-label={`What ${member.name} works on`} className="mt-4 flex flex-wrap gap-2">
                {member.skills.map((skill) => (
                  <li key={skill} className="rounded-md bg-mist px-2.5 py-1 text-[12.5px] font-medium text-ink">
                    {skill}
                  </li>
                ))}
              </ul>
            ) : null}
            {member.socials.length > 0 ? (
              <ul className="mt-auto flex flex-wrap gap-x-5 pt-5 text-[14.5px]">
                {member.socials.map((social) => (
                  <li key={social.href}>
                    <a href={social.href} rel="me noopener" className="inline-block py-1 font-semibold text-primary hover:text-primaryd">
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
