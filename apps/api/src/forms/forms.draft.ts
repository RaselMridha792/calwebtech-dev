import type { Prisma } from '@calwebtech/db';
import type { FormsProjectDraft } from '@calwebtech/shared';

/*
 * Progressive saving for the start a project brief (docs/06-build-plan.md, task 5.2).
 *
 * An unfinished brief is an ordinary `Lead` of type PROJECT whose `answers.draft` records
 * the step the visitor reached and the token that lets the same browser go on writing to it.
 * The final submit sends that id and token to `POST /leads`, which completes the same lead,
 * so a brief is never counted twice and the drop-off per step stays countable.
 *
 * `Lead.status` has no draft state and adding one would be a migration the family does not
 * own, so an unfinished brief is recognised by `answers.draft.completedAt` being absent.
 */

/** The unfinished brief's stored answers, split from the draft's own bookkeeping. */
export interface OpenProjectDraft {
  /** Everything in `answers` except the `draft` key. */
  answers: Prisma.InputJsonObject;
  /** The `answers.draft` object as it was stored. */
  draft: Prisma.InputJsonObject;
}

/**
 * A JSON column's value as an object. The column is written only by this family and by the
 * leads service, so anything else (a string, an array, null) reads as no answers at all.
 */
export function asJsonObject(value: unknown): Prisma.InputJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function text(value: Prisma.InputJsonValue | null | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function count(value: Prisma.InputJsonValue | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * The lead's draft state when `token` is the one the API issued for it and the brief has
 * not been completed yet; null otherwise, so a guessed id, a stale token or a finished
 * brief writes nothing.
 */
export function openProjectDraft(answers: unknown, token: string | undefined): OpenProjectDraft | null {
  if (!token) return null;
  const stored = asJsonObject(answers);
  const draft = asJsonObject(stored.draft);
  if (draft.token !== token || text(draft.completedAt) !== undefined) return null;
  const rest: Prisma.InputJsonObject = Object.fromEntries(
    Object.entries(stored).filter(([key]) => key !== 'draft'),
  );
  return { answers: rest, draft };
}

/** The columns a saved step writes. Null clears an answer the visitor went back and removed. */
export function projectDraftFields(input: FormsProjectDraft) {
  return {
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    company: input.company ?? null,
    message: input.message ?? null,
    budgetBand: input.budgetBand ?? null,
    timeline: input.timeline ?? null,
    projectType: input.projectType ?? null,
    siteUrl: input.siteUrl ?? null,
    serviceInterest: input.serviceInterest,
  };
}

/** Structured answers without a column of their own. */
export function projectDraftAnswerFields(input: Pick<FormsProjectDraft, 'projectLinks'>): Prisma.InputJsonObject {
  return { projectLinks: input.projectLinks ?? null };
}

/**
 * `answers` for a saved step: what was stored before, the answers of this step, and the
 * bookkeeping. `furthestStep` never goes back, so returning to step two to fix an email
 * does not make the brief look abandoned earlier than it was.
 */
export function projectDraftAnswers(
  input: FormsProjectDraft,
  previous: OpenProjectDraft | null,
  token: string,
  now: Date,
): Prisma.InputJsonObject {
  const at = now.toISOString();
  return {
    ...(previous?.answers ?? {}),
    ...projectDraftAnswerFields(input),
    draft: {
      token,
      formId: input.formId,
      step: input.step,
      furthestStep: Math.max(count(previous?.draft.furthestStep), input.step),
      startedAt: text(previous?.draft.startedAt) ?? at,
      updatedAt: at,
    },
  };
}

/**
 * `answers` for the brief's final submit: the draft's answers, the submitted ones, and the
 * draft marked complete at `now`, which is what tells an unfinished brief from a sent one.
 */
export function completedDraftAnswers(
  draft: OpenProjectDraft,
  submitted: Prisma.InputJsonObject,
  now: Date,
): Prisma.InputJsonObject {
  return {
    ...draft.answers,
    ...submitted,
    draft: { ...draft.draft, completedAt: now.toISOString() },
  };
}

/** The attribution row a brief carries, the same shape the leads service writes. */
export function projectDraftAttribution(input: FormsProjectDraft) {
  return {
    firstTouchUtm: input.attribution.firstTouch,
    lastTouchUtm: input.attribution.lastTouch,
    referrer: input.attribution.referrer,
    landingPage: input.attribution.landingPage,
    device: input.attribution.device,
    formId: input.formId,
  };
}
