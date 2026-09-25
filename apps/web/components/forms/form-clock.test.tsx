import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formElapsed } from '@/lib/form-clock-field';
import { FormClock } from './form-clock';

describe('the form clock', () => {
  it('renders an empty hidden field, which the server reads as no figure', () => {
    const html = renderToStaticMarkup(<FormClock />);
    expect(html).toBe('<input type="hidden" name="formElapsedMs"/>');
    const form = new FormData();
    form.set('formElapsedMs', '');
    expect(formElapsed(form)).toBeUndefined();
    form.set('formElapsedMs', '3150');
    expect(formElapsed(form)).toBe('3150');
  });
});
