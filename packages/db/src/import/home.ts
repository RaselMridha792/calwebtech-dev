import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const homeImporter: SnapshotImporter = {
  family: 'home',
  run(ctx) {
    ctx.log('import: home: TODO, nothing written');
    return Promise.resolve();
  },
};
