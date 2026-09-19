import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const staticImporter: SnapshotImporter = {
  family: 'static',
  run(ctx) {
    ctx.log('import: static: TODO, nothing written');
    return Promise.resolve();
  },
};
