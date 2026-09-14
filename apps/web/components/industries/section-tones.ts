import type { IndustryDetailView } from '@calwebtech/shared';

/** The sections of an industry page below the hero, in the order docs/03-page-specs.md sets. */
export const INDUSTRY_SECTIONS = [
  'painPoints',
  'services',
  'compliance',
  'caseStudies',
  'results',
  'integrations',
  'faq',
] as const;

export type IndustrySection = (typeof INDUSTRY_SECTIONS)[number];
export type IndustrySectionTone = 'white' | 'tint' | 'ink';

/**
 * A tone for each section the page renders, so no two neighbours share one whatever copy
 * or records are missing (docs/05-design-system.md, Section rhythm). The results band is
 * the image-with-overlay section; light sections alternate white and tinted around it,
 * counted back from the end so the last one is white against the closing band's tint.
 */
export function industrySectionTones(page: Pick<IndustryDetailView, IndustrySection>): Partial<Record<IndustrySection, IndustrySectionTone>> {
  const tones: Partial<Record<IndustrySection, IndustrySectionTone>> = {};
  let light = 0;
  for (const section of [...INDUSTRY_SECTIONS].reverse()) {
    if (page[section] === null) continue;
    if (section === 'results') {
      tones[section] = 'ink';
      light = 0;
      continue;
    }
    tones[section] = light % 2 === 0 ? 'white' : 'tint';
    light += 1;
  }
  return tones;
}
