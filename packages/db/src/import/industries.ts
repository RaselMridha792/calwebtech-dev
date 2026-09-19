import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const industriesImporter: SnapshotImporter = {
  family: 'industries',
  run(ctx) {
    ctx.log('import: industries: TODO, nothing written');
    return Promise.resolve();
  },
};
