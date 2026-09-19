import type { SnapshotImporter } from './index';

/** TODO(content-import): not written yet. A no-op so the other families can be verified. */
export const calculatorImporter: SnapshotImporter = {
  family: 'calculator',
  run(ctx) {
    ctx.log('import: calculator: TODO, nothing written');
    return Promise.resolve();
  },
};
