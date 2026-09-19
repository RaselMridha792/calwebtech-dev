import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const formsImporter: SnapshotImporter = {
  family: 'forms',
  run(ctx) {
    ctx.log('import: forms: TODO, nothing written');
    return Promise.resolve();
  },
};
