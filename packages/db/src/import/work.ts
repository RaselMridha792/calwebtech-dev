import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const workImporter: SnapshotImporter = {
  family: 'work',
  run(ctx) {
    ctx.log('import: work: TODO, nothing written');
    return Promise.resolve();
  },
};
