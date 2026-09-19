import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const companyImporter: SnapshotImporter = {
  family: 'company',
  run(ctx) {
    ctx.log('import: company: TODO, nothing written');
    return Promise.resolve();
  },
};
