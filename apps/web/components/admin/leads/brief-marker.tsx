import { FORMS_PROJECT_STEP_COUNT } from '@calwebtech/shared';
import { TAG } from '../ui/styles';

/**
 * A start-a-project brief nobody sent, marked where the inbox would otherwise say "Brief",
 * so it is not read as an ordinary new lead (decision 69). A dashed edge, and the step in
 * words for a pointer and a screen reader.
 */
export function UnfinishedBrief({ step }: { step: number }) {
  const where = `Unfinished brief, stopped at step ${String(step)} of ${String(FORMS_PROJECT_STEP_COUNT)}`;
  return (
    <span title={where} className={`${TAG} border-dashed`}>
      <span aria-hidden>Unfinished</span>
      <span className="sr-only">{where}</span>
    </span>
  );
}
