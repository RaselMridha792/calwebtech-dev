import type { CompanyAward, CompanyPartner } from '@calwebtech/shared';
import { reveal } from '@/components/ui/primitives';
import { ResponsiveImage } from '@/components/ui/responsive-image';

const awardDetail = (award: CompanyAward) =>
  [award.projectName ?? award.category, String(award.year)].filter((part): part is string => Boolean(part)).join(', ');

/**
 * Awards with the body that gave them, the year and, where there is one, the project it
 * recognised. `compact` is the about page's preview: name and detail only, as on the homepage.
 */
export function AwardList({ awards, compact = false }: { awards: readonly CompanyAward[]; compact?: boolean }) {
  if (compact) {
    return (
      <ul data-company-list="awards" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {awards.map((award, index) => (
          <li key={award.id} data-award="" className="rounded-2xl border border-line bg-white p-6" {...reveal(index)}>
            <h3 className="font-display text-[16.5px] font-bold text-ink">{award.name}</h3>
            <p className="mt-2 text-[14px] leading-relaxed">{awardDetail(award)}</p>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul data-company-list="awards" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {awards.map((award, index) => {
        const by = [award.awardingBody, award.category].filter((part): part is string => Boolean(part)).join(' · ');
        return (
          <li
            key={award.id}
            data-award=""
            className="flex flex-col rounded-2xl border border-line bg-white p-7"
            {...reveal(index)}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="rounded-md bg-mist px-2.5 py-1 font-display text-[14px] font-bold text-ink">
                <time dateTime={String(award.year)}>{award.year}</time>
              </p>
              {award.badge ? (
                <ResponsiveImage
                  src={award.badge.src}
                  alt={award.badge.alt}
                  width={56}
                  height={56}
                  sizes="56px"
                  className="h-14 w-14 object-contain"
                />
              ) : null}
            </div>
            <h3 className="mt-5 font-display text-[20px] leading-snug font-bold text-ink">{award.name}</h3>
            {by ? <p className="mt-1.5 text-[14px] font-medium">{by}</p> : null}
            {award.projectName ? <p className="mt-4 text-[14.5px] font-semibold text-ink">{award.projectName}</p> : null}
            {award.description ? <p className="mt-2 text-[15px] leading-relaxed">{award.description}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Partners with their certification and, in full, what the partnership means for a client.
 * `compact` lists names and certifications only.
 */
export function PartnerList({
  partners,
  meaningLabel,
  compact = false,
}: {
  partners: readonly CompanyPartner[];
  meaningLabel?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <ul data-company-list="partners" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {partners.map((partner, index) => (
          <li key={partner.id} data-partner="" className="rounded-xl border border-line bg-white px-5 py-6 text-center" {...reveal(index)}>
            <h3 className="font-display text-[16.5px] font-bold text-ink">{partner.name}</h3>
            {(partner.certification ?? partner.tier) ? (
              <p className="mt-1 text-[13.5px]">{partner.certification ?? partner.tier}</p>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul data-company-list="partners" className="grid gap-5 md:grid-cols-2 lg:gap-6">
      {partners.map((partner, index) => {
        const status = [partner.tier, partner.certification].filter((part): part is string => Boolean(part)).join(' · ');
        return (
          <li
            key={partner.id}
            data-partner=""
            className="flex flex-col rounded-2xl border border-line bg-white p-7 lg:p-8"
            {...reveal(index)}
          >
            <div className="flex items-center gap-4">
              {partner.logo ? (
                <ResponsiveImage
                  src={partner.logo.src}
                  alt={partner.logo.alt}
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-12 w-12 object-contain"
                />
              ) : null}
              <div>
                <h3 className="font-display text-[22px] font-extrabold text-ink">{partner.name}</h3>
                {status ? <p className="text-[14px] font-medium">{status}</p> : null}
              </div>
            </div>
            {partner.meaningForClient ? (
              <div className="mt-5 border-t border-line pt-5">
                {meaningLabel ? <p className="text-[13.5px] font-semibold text-ink">{meaningLabel}</p> : null}
                <p className="mt-1.5 text-[15.5px] leading-relaxed">{partner.meaningForClient}</p>
              </div>
            ) : null}
            {partner.quote ? (
              <blockquote className="mt-5 border-l-4 border-line pl-4 text-[15px] leading-relaxed text-ink">
                {`"${partner.quote}"`}
              </blockquote>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
