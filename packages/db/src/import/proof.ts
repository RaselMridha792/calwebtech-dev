import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const proofImporter: SnapshotImporter = {
  family: 'proof',
  run(ctx) {
    ctx.log('import: proof: TODO, nothing written');
    return Promise.resolve();
  },
};
