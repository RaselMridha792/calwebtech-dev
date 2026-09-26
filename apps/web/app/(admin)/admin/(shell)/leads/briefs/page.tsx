import {
  BRIEF_FIRST_MEASURED_STEP,
  BRIEF_FUNNEL_PERIODS,
  BRIEF_STEP_LABELS,
  adminBriefFunnelQuerySchema,
  adminBriefFunnelSchema,
} from '@calwebtech/shared';
import Link from 'next/link';
import { ShareBar, StatCard } from '@/components/admin/ui/charts';
import { AdminPage, BackLink, ChipLinks, PageHeader, Panel } from '@/components/admin/ui/page';
import { LINK, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * Where start-a-project briefs stop (docs/06-build-plan.md, task 5.2; decision 69): for a
 * chosen period, how many briefs reached each step, how many stopped there, and how many were
 * sent. Read only; the API applies the leads module's permission to it.
 */
export default async function BriefDropOffPage({ searchParams }: PageProps<'/admin/leads/briefs'>) {
  await requireModule('leads', 'read');
  const params = await searchParams;
  const { days } = adminBriefFunnelQuerySchema.parse({ days: typeof params.days === 'string' ? params.days : undefined });
  const funnel = await adminGet(`/admin/leads/brief-funnel?days=${String(days)}`, adminBriefFunnelSchema);

  const unfinished = funnel.started - funnel.finished;
  const rate = funnel.started === 0 ? null : Math.round((funnel.finished / funnel.started) * 100);
  const worst = funnel.steps
    .filter((step) => step.measured && step.stoppedHere > 0)
    .sort((a, b) => b.stoppedHere - a.stoppedHere)[0];

  return (
    <AdminPage>
      <BackLink href="/admin/leads/">Back to the inbox</BackLink>
      <PageHeader
        eyebrow="Sales"
        title="Where briefs stop"
        description={
          <>
            The start-a-project form in six steps: how many briefs reached each one, how many stopped there, and how many
            were sent, for briefs begun in the last {days} days.
          </>
        }
        actions={
          unfinished > 0 ? (
            <Link href="/admin/leads/?brief=unfinished&includeClosed=true" className={button('secondary')}>
              See the unfinished briefs
            </Link>
          ) : null
        }
      />

      <ChipLinks
        label="Period"
        chips={BRIEF_FUNNEL_PERIODS.map((period) => ({
          href: period === 30 ? '/admin/leads/briefs/' : `/admin/leads/briefs/?days=${String(period)}`,
          label: `Last ${String(period)} days`,
          current: period === days,
        }))}
      />

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Briefs begun" value={funnel.started} note="reached step 3" />
        <StatCard label="Sent" value={funnel.finished} note="finished all six steps" />
        <StatCard label="Not sent" value={unfinished} note={worst ? `most stopped at step ${String(worst.step)}` : 'none stopped'} />
        <StatCard label="Finished" value={rate === null ? '—' : `${String(rate)}%`} note="of the briefs begun" />
      </section>

      <Panel
        title="Step by step"
        labelledBy="brief-steps"
        description="Each bar is the share of begun briefs that got at least this far."
        flush
      >
        {funnel.started === 0 ? (
          <p className="border-t border-admin-line2 px-4 py-6 text-[14px] text-ink-invert-muted sm:px-6">
            No brief was begun in these {days} days.
          </p>
        ) : (
          <ol className="divide-y divide-admin-line2 border-t border-admin-line2">
            {funnel.steps.map((step) => (
              <li key={step.key} className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-admin-line bg-admin-sunken font-display text-[13px] font-bold text-ink-invert"
                  >
                    {step.step}
                  </span>
                  <span className="text-[14.5px] font-semibold text-ink-invert">
                    <span className="sr-only">Step {step.step}: </span>
                    {BRIEF_STEP_LABELS[step.key]}
                  </span>
                </div>
                <ShareBar share={funnel.started === 0 ? 0 : step.reached / funnel.started} />
                <p className="text-[13.5px] text-ink-invert-muted tabular-nums sm:text-right">
                  <span className="font-semibold text-ink-invert">{step.reached}</span> reached
                  {step.measured ? (
                    <>
                      {' · '}
                      <span className={step.stoppedHere > 0 ? 'font-semibold text-ink-invert' : ''}>{step.stoppedHere}</span> stopped
                      here
                    </>
                  ) : (
                    <> · not measured</>
                  )}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <p className="max-w-[760px] text-[12.5px] leading-[1.6] text-admin-muted">
        A brief is first saved when someone leaves step {BRIEF_FIRST_MEASURED_STEP - 1}, the contact details, because that is when
        there is an email address to keep it under. So everyone counted here passed steps 1 and 2, and anyone who left before
        that is not seen. Unfinished briefs are in the inbox, marked{' '}
        <Link href="/admin/leads/?brief=unfinished&includeClosed=true" className={LINK}>
          Unfinished
        </Link>
        .
      </p>
    </AdminPage>
  );
}
