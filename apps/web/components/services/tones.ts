import type { SectionTone } from '@/components/site/section';

/** What a section would like to sit on: any light tone, or the ink or colour band treatment. */
export type TonePreference = 'light' | 'ink' | 'band';

/**
 * Tones for a page's sections in order, following the approved rhythm (docs/05, Section
 * rhythm): light sections alternate white with the tinted and mist grounds, and ink and band
 * sections keep their treatment unless that would repeat the tone before them. Sections a
 * record has no content for are left out before this runs, so no two neighbours ever share
 * a tone, including the dark hero above (`after`) and the closing band below (`before`).
 */
export function sectionTones(
  preferences: readonly TonePreference[],
  { after = 'ink', before = 'mist' }: { after?: SectionTone; before?: SectionTone } = {},
): SectionTone[] {
  const tones: SectionTone[] = [];
  let previous = after;
  let tinted: 'tint' | 'mist' = 'tint';
  for (const preference of preferences) {
    let tone: SectionTone;
    if (preference !== 'light' && preference !== previous) {
      tone = preference;
    } else if (previous !== 'white') {
      tone = 'white';
    } else {
      tone = tinted;
      tinted = tinted === 'tint' ? 'mist' : 'tint';
    }
    tones.push(tone);
    previous = tone;
  }
  const last = tones.length - 1;
  if (last >= 0 && tones[last] === before) {
    const alternatives: SectionTone[] = ['white', 'tint', 'mist'];
    tones[last] = alternatives.find((tone) => tone !== before && tone !== (tones[last - 1] ?? after)) ?? 'white';
  }
  return tones;
}
