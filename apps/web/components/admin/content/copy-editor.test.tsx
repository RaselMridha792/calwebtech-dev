import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CopyEditor, emptied, humanize, ordered, plainly, shapeKey, type Json } from './copy-editor';

/**
 * The page copy editor turns a page's stored copy into fields. What matters is that every
 * word is reachable as a labelled field, that an error lands under the field it is about,
 * and that the structure it offers to add is the one the schema describes, never a guess.
 */
const COPY: Json = {
  title: 'Test marina website design',
  hero: { intro: 'Test boat owners book from the quay.', primaryCta: { label: 'Test call', href: '/contact/' } },
  painPoints: { heading: 'Which test problems come up?', intro: null, items: [{ title: 'Test one', body: 'Test body.' }] },
  compliance: null,
  highlights: ['Test highlight'],
};

const render = (props: Partial<Parameters<typeof CopyEditor>[0]> = {}) =>
  renderToStaticMarkup(<CopyEditor value={COPY} onChange={() => undefined} {...props} />);

describe('the page copy editor', () => {
  it('shows every piece of copy as a labelled field, and each section as a named group', () => {
    const html = render();
    for (const text of ['Test marina website design', 'Test boat owners book from the quay.', 'Test call', '/contact/', 'Test one', 'Test highlight']) {
      expect(html).toContain(text);
    }
    // A top-level section is a card headed by an h2; a group inside it is headed one level down.
    expect(html).toMatch(/<section aria-labelledby="([^"]+)"[^>]*><h2 id="\1"[^>]*>Pain points<\/h2>/);
    expect(html).toContain('>Primary call to action</h3>');
    // Every input and textarea has a label pointing at it.
    const ids = [...html.matchAll(/<(?:input|textarea) id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(html).toContain(`for="${id ?? ''}"`);
  });

  it('writes long copy in a text area and short copy in a line', () => {
    const html = render();
    expect(html).toMatch(/<textarea[^>]*>Test boat owners book from the quay\.<\/textarea>/);
    expect(html).toMatch(/<input[^>]*value="Test marina website design"/);
  });

  it('puts an error from the API under the field it names', () => {
    const html = render({ errorPrefix: 'content', errors: { 'content.painPoints.items.0.title': ['Test title is required'] } });
    const field = html.indexOf('value="Test one"');
    const error = html.indexOf('Test title is required');
    expect(field).toBeGreaterThan(-1);
    expect(error).toBeGreaterThan(field);
    expect(html.slice(field - 400, field)).toContain('aria-invalid="true"');
  });

  it('offers to add a section only where it knows its shape, and to leave it out again', () => {
    expect(render()).not.toContain('Add compliance');
    const html = render({ shapes: { compliance: { heading: '', notes: [] }, 'painPoints.intro': '' } });
    expect(html).toContain('Add compliance');
    // A piece of copy that may be empty is a field, not a missing section.
    expect(html).not.toContain('Intro</span> is not set');
  });

  it('names a path the way the shapes do, and empties an item for the next entry', () => {
    expect(shapeKey(['painPoints', 'items', 3, 'title'])).toBe('painPoints.items.#.title');
    expect(emptied({ title: 'Test', count: 3, flags: [true], cta: { label: 'x', href: 'y' }, image: null })).toEqual({
      title: '',
      count: 0,
      flags: [],
      cta: { label: '', href: '' },
      image: null,
    });
    expect(humanize('primaryCta')).toBe('Primary call to action');
    expect(humanize('seo')).toBe('Search result');
    expect(humanize('linkLabel')).toBe('Link label');
  });

  it('lays stored copy out in the order of the page, whatever order the database kept its keys in', () => {
    const stored: Json = { faq: { intro: null, heading: 'Test FAQ?' }, title: 'Test', extra: 1, hero: { intro: 'Test.' } };
    const template: Json = { title: '', hero: { intro: '' }, faq: { heading: '', intro: null } };
    const result = ordered(stored, template) as Record<string, Json>;
    expect(Object.keys(result)).toEqual(['title', 'hero', 'faq', 'extra']);
    expect(Object.keys(result.faq as Record<string, Json>)).toEqual(['heading', 'intro']);
    expect(ordered([{ b: 1, a: 2 }], [{ a: 0, b: 0 }])).toEqual([{ a: 2, b: 1 }]);
  });

  it('says what a length rule means in plain words, and keeps a schema’s own message', () => {
    expect(plainly('Too small: expected string to have >=1 characters')).toBe('This cannot be empty.');
    expect(plainly('Too big: expected string to have <=80 characters')).toBe('Keep this to 80 characters or fewer.');
    expect(plainly('Too small: expected array to have >=1 items')).toBe('This needs at least 1.');
    expect(plainly('Alt text is required')).toBe('Alt text is required');
  });
});
