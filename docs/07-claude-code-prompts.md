# 07. Working With Claude Code on This Repo

## First session

Paste this:

> Read `CLAUDE.md`, then `docs/00-project-brief.md` and `docs/01-architecture.md`.
> Summarise back to me what we are building, the non-negotiables, and anything in
> those documents that looks contradictory or underspecified. Do not write code yet.

Reading it back first catches misunderstandings while they are cheap.

## Starting a task

One task per session. Reference the task number so the acceptance criterion comes
with it:

> Task 1.3 from `docs/06-build-plan.md`. Read that task, plus the Service sections of
> `docs/02-content-model.md` and `docs/03-page-specs.md`, and the Service rows in
> `prisma/schema.prisma`. Plan the work before writing code, then implement it.

## Rules worth repeating in-session

- Plan before implementing on anything touching the data model or the API contract.
- Open `reference/homepage.html` before building a component that appears there.
- Do not add a dependency without saying what it replaces and why the built-in option
  is insufficient.
- If a task cannot meet its acceptance criterion, say so rather than shipping
  something that half meets it.

## Things Claude Code tends to get wrong here, so check them

1. **Client components creeping upward.** `"use client"` on a page instead of on the
   small interactive leaf. Check the bundle after every UI task.
2. **Prisma called from the web app.** Data access belongs in the API so business
   rules live in one place.
3. **Duplicated Zod schemas.** They belong in `packages/shared` and are imported by
   both sides. Duplication is how the contract drifts.
4. **Forgetting the answer block.** Every service, industry, location, glossary and
   article template opens with it. It is a field on the model, not optional copy.
5. **Hardcoding content that should be a record.** If it repeats, it is a content type.
6. **Losing the video poster fallback.** The poster must render before and instead of
   the video, always.
7. **Silently dropping the performance budget.** If a task needs a heavy library, it
   gets dynamically imported or it gets discussed.

## Review checklist before merging

- [ ] Type checks, lints, tests pass
- [ ] Lighthouse gate passes
- [ ] Works at 360px and 1440px
- [ ] Keyboard operable, focus visible, focus returns after modals
- [ ] Admin can edit whatever this produced without a deploy
- [ ] Metadata, schema and sitemap entry generated for any new public template
- [ ] No secrets, no `any`, no raw hex colours
- [ ] Acceptance criterion from `docs/06-build-plan.md` demonstrably met
