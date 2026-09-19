import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const insightsImporter: SnapshotImporter = {
  family: 'insights',
  run(ctx) {
    ctx.log('import: insights: TODO, nothing written');
    return Promise.resolve();
  },
};
