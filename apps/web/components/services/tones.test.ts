import { describe, expect, it } from 'vitest';
import { sectionTones } from './tones';

describe('sectionTones', () => {
  it('alternates white with the tinted grounds and keeps ink and band where they fit', () => {
    expect(sectionTones(['light', 'light', 'ink', 'light', 'light', 'band', 'light', 'light'])).toEqual([
      'white',
      'tint',
      'ink',
      'white',
      'mist',
      'band',
      'white',
      'tint',
    ]);
  });

  it('never repeats a tone next to itself, including the hero above and the closing band below', () => {
    const preferences = [
      ['ink', 'light', 'light'],
      ['light', 'light', 'light', 'light'],
      ['band', 'band', 'ink', 'ink'],
      ['light'],
      [],
    ] as const;
    for (const list of preferences) {
      const tones = sectionTones(list);
      ['ink', ...tones, 'mist'].forEach((tone, index, all) => {
        if (index > 0) expect(tone, JSON.stringify(tones)).not.toBe(all[index - 1]);
      });
    }
  });

  it('moves a light section off the ground of the band that follows the page', () => {
    expect(sectionTones(['light', 'light', 'light', 'light'])).toEqual(['white', 'tint', 'white', 'tint']);
    expect(sectionTones(['light', 'light', 'light', 'light', 'light', 'light'])).toEqual([
      'white',
      'tint',
      'white',
      'mist',
      'white',
      'tint',
    ]);
  });
});
