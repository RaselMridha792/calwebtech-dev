import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const locationsImporter: SnapshotImporter = {
  family: 'locations',
  run(ctx) {
    ctx.log('import: locations: TODO, nothing written');
    return Promise.resolve();
  },
};
