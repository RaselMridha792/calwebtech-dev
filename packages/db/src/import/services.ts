import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const servicesImporter: SnapshotImporter = {
  family: 'services',
  run(ctx) {
    ctx.log('import: services: TODO, nothing written');
    return Promise.resolve();
  },
};
