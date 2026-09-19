import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const landingImporter: SnapshotImporter = {
  family: 'landing',
  run(ctx) {
    ctx.log('import: landing: TODO, nothing written');
    return Promise.resolve();
  },
};
