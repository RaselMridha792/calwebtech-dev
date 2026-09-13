import { describe, expect, it } from 'vitest';
import { describeModule } from './bundle-lib.mjs';

const pnpm = (pkg, file) =>
  `[project]/node_modules/.pnpm/${pkg.replace('/', '+')}@1.0.0/node_modules/${pkg}/${file} [app-client] (ecmascript)`;

describe('describeModule', () => {
  it('counts React, React DOM and the Next.js runtime as framework', () => {
    expect(describeModule(pnpm('next', 'dist/compiled/react-dom/cjs/react-dom-client.production.js')).framework).toBe(true);
    expect(describeModule(pnpm('react', 'cjs/react.production.js')).framework).toBe(true);
    expect(describeModule(pnpm('@swc/helpers', 'esm/_interop_require_default.js')).framework).toBe(true);
  });

  it('counts our components and any added library as own code', () => {
    expect(describeModule('[project]/apps/web/components/forms/lead-form.tsx [app-client] (ecmascript)')).toMatchObject({
      framework: false,
      group: 'apps/web',
    });
    expect(describeModule(pnpm('zod', 'v4/classic/schemas.js')).framework).toBe(false);
    expect(describeModule('[project]/packages/shared/dist/lead.js [app-client] (ecmascript)').framework).toBe(false);
  });

  it('groups Next.js modules by area', () => {
    expect(describeModule(pnpm('next', 'dist/client/components/segment-cache/cache.js')).group).toBe(
      'next/dist/client/components/segment-cache',
    );
  });
});
