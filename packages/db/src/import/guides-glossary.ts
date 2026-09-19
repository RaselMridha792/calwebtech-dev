import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const guidesGlossaryImporter: SnapshotImporter = {
  family: 'guides-glossary',
  run(ctx) {
    ctx.log('import: guides-glossary: TODO, nothing written');
    return Promise.resolve();
  },
};
