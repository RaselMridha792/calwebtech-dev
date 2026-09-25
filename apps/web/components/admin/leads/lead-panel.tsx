import type { AdminLeadDetail, AdminLeadQuery, AdminLeadTimelineEntry } from '@calwebtech/shared';
import Link from 'next/link';
import { CloseIcon } from '../icons';
import { KICKER, button, iconButton } from '../ui/styles';
import { budgetLabel, channelLabel, dateInputValue, receivedLong, timelineLabel, typeLabel } from './format';
import { NoteForm } from './note-form';
import { PipelineForm } from './pipeline-form';
import { leadsUrl } from './query-url';
import { StatusPill } from './status-pill';

/**
 * One lead, in full (docs/12-admin-dashboard.md, modules 2 and 3).
 *
 * The panel beside the table and the full record are the same content in two containers,
 * so this is built once and given a width by its caller. Which lead is open is a URL
 * parameter, not component state, so the panel survives a reload and can be linked to.
 */
export function LeadPanel({
  lead,
  query,
  owners,
  statuses,
  mayWrite,
  full = false,
}: {
  lead: AdminLeadDetail;
  query: AdminLeadQuery;
  owners: { id: string; name: string }[];
  statuses: { value: string; label: string }[];
  mayWrite: boolean;
  full?: boolean;
}) {
  const firstName = lead.name.split(/\s+/)[0] ?? lead.name;

  const sections = (
    <>
      <Section heading="Pipeline" id="lead-pipeline">
        {mayWrite ? (
          <PipelineForm
            leadId={lead.id}
            status={lead.status}
            statuses={statuses}
            ownerId={lead.owner?.id ?? ''}
            owners={owners}
            nextActionDate={dateInputValue(lead.nextActionDate)}
          />
        ) : (
          <Fields
            rows={[
              ['Status', statuses.find((entry) => entry.value === lead.status)?.label ?? lead.status],
              ['Owner', lead.owner?.name ?? 'Unassigned'],
              ['Next action', dateInputValue(lead.nextActionDate) || '—'],
            ]}
          />
        )}
      </Section>

      <Section heading={submissionHeading(lead.type)} id="lead-submission">
        <Fields rows={submissionRows(lead)} />
      </Section>

      <Section heading="Who they are" id="lead-identity">
        <Fields
          rows={[
            ['Name', lead.name],
            ['Email', lead.email],
            ['Phone', lead.phone ?? '—'],
            ['Company', lead.company ?? '—'],
            ['Value band', budgetLabel(lead.budgetBand)],
            ['Reference', lead.id],
          ]}
        />
        {lead.contact ? (
          <p className="mt-3.5 rounded-lg border border-admin-line2 bg-admin-surface px-3 py-2.5 text-[13px] leading-[1.55] text-ink-invert-muted">
            Linked to one contact — {lead.contact.submissions}{' '}
            {lead.contact.submissions === 1 ? 'submission' : 'submissions'} from this person resolve to the same record,
            so they are not counted twice.
          </p>
        ) : null}
      </Section>

      <Section heading="How they found us" id="lead-attribution">
        {lead.attribution ? (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <TouchCard label="First visit" utm={lead.attribution.firstTouch} fallback={channelLabel(lead.channel)} />
              <TouchCard label="Last visit" utm={lead.attribution.lastTouch} fallback={channelLabel(lead.channel)} />
            </div>
            <div className="mt-4">
              <Fields
                rows={[
                  ['Channel', channelLabel(lead.channel)],
                  ['Referrer', lead.attribution.referrer ?? '—'],
                  ['Landing page', lead.attribution.landingPage ?? '—'],
                  ['Campaign', lead.attribution.campaign ?? '—'],
                  ['Form', lead.attribution.formId ?? '—'],
                  ['Device', lead.attribution.device ?? '—'],
                ]}
                breakAll
              />
            </div>
          </>
        ) : (
          <p className="text-[14px] text-ink-invert-muted">
            Nothing was recorded for this submission, which is what a direct visit with no campaign looks like.
          </p>
        )}
      </Section>

      <Section heading="Timeline and notes" id="lead-timeline">
        {lead.entries.length === 0 ? (
          <p className="text-[14px] text-ink-invert-muted">Nothing has happened to this lead since it arrived.</p>
        ) : (
          <ol className="flex flex-col">
            {lead.entries.map((entry) => (
              <TimelineRow key={`${entry.kind}-${entry.id}`} entry={entry} />
            ))}
          </ol>
        )}
        {mayWrite ? <NoteForm leadId={lead.id} /> : null}
      </Section>

      <Section heading="Emails sent" id="lead-emails">
        {lead.emails.length === 0 ? (
          <p className="text-[14px] text-ink-invert-muted">
            No delivery events yet. Nothing is recorded here until the sending domain and its webhooks are live.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lead.emails.map((email) => (
              <li key={email.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] text-ink-invert">{email.subject}</span>
                  <span className="block text-[12.5px] text-admin-muted">
                    {receivedLong(email.occurredAt)} · to {email.to}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-ink-invert-muted">
                  <span aria-hidden className="size-2 rounded-full bg-result" />
                  {email.state}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );

  return (
    <aside
      aria-label="Lead detail"
      className={
        full
          ? 'flex flex-col rounded-xl border border-admin-line2 bg-admin-surface p-4 sm:p-6'
          : 'flex w-full shrink-0 flex-col bg-admin-sunken lg:sticky lg:top-0 lg:h-[calc(100dvh-4rem)] lg:w-[440px] lg:border-l lg:border-admin-line2'
      }
    >
      <header className={`flex shrink-0 flex-col gap-4 border-b border-admin-line2 ${full ? 'pb-6' : 'px-4 pt-6 pb-5 sm:px-6'}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-ink-invert">
                {lead.name}
              </h2>
              <StatusPill status={lead.status} />
            </div>
            <p className="mt-1.5 text-[13.5px] text-ink-invert-muted">
              {[lead.company, typeLabel(lead.type), `received ${receivedLong(lead.createdAt)}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          {full ? null : (
            <Link href={leadsUrl(query)} className={iconButton('sm')}>
              <CloseIcon className="size-4" />
              <span className="sr-only">Close lead detail</span>
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`mailto:${lead.email}`} className={button('secondary', 'sm')}>
            Email {firstName}
          </a>
          {lead.phone ? (
            <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`} className={button('secondary', 'sm')}>
              Call
            </a>
          ) : null}
          {full ? null : (
            <Link href={`/admin/leads/${encodeURIComponent(lead.id)}/`} className={button('ghost', 'sm')}>
              Open full record
            </Link>
          )}
        </div>
      </header>

      <div className={full ? '' : 'px-4 pb-8 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto'}>{sections}</div>
    </aside>
  );
}

function Section({ heading, id, children }: { heading: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-b border-admin-line2 py-5 last:border-b-0">
      <h3 id={id} className={`${KICKER} mb-3.5`}>
        {heading}
      </h3>
      {children}
    </section>
  );
}

function Fields({ rows, breakAll }: { rows: [string, string][]; breakAll?: boolean }) {
  return (
    <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[14px]">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-admin-muted">{term}</dt>
          <dd className={`text-ink-invert ${breakAll ? 'break-all' : 'break-words'}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TouchCard({
  label,
  utm,
  fallback,
}: {
  label: string;
  utm: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
  fallback: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-admin-line2 bg-admin-surface px-3 py-3">
      <p className="text-[12px] text-admin-muted">{label}</p>
      <p className="mt-1 truncate text-[14px] font-semibold text-ink-invert">{utm?.source ?? fallback}</p>
      <p className="truncate text-[12.5px] text-admin-muted">
        {[utm?.medium, utm?.campaign].filter(Boolean).join(' · ') || 'no campaign recorded'}
      </p>
    </div>
  );
}

/**
 * A note is a square mark, an activity a round one, so the two read apart at a glance. A
 * thin rule joins the marks into one line down the page.
 */
function TimelineRow({ entry }: { entry: AdminLeadTimelineEntry }) {
  const note = entry.kind === 'note';
  return (
    <li className="relative flex gap-3 pb-4 before:absolute before:top-4 before:bottom-0 before:left-[3.5px] before:w-px before:bg-admin-line2 last:pb-0 last:before:hidden">
      <span
        aria-hidden
        className={`relative mt-[7px] size-2 shrink-0 ${note ? 'rounded-[2px] bg-admin-dot' : 'rounded-full bg-admin-muted'}`}
      />
      <span className="min-w-0">
        <span className="block text-[14px] leading-[1.55] break-words text-ink-invert">
          {note ? entry.body : activityText(entry)}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-admin-muted">
          {note ? `${entry.author?.name ?? 'Someone'} · ` : ''}
          {receivedLong(entry.createdAt)} · {note ? 'note' : 'activity'}
        </span>
      </span>
    </li>
  );
}

/**
 * An activity's `detail` is free-form JSON written by whatever recorded it, so anything
 * that is not a plain scalar is shown as an em dash rather than as "[object Object]".
 */
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '—';
}

function activityText(entry: Extract<AdminLeadTimelineEntry, { kind: 'activity' }>): string {
  const detail = entry.detail as Record<string, unknown> | null;
  switch (entry.type) {
    case 'status_change':
      return `Status moved from ${text(detail?.from)} to ${text(detail?.to)}${
        detail?.reason ? ` — ${text(detail.reason)}` : ''
      }`;
    case 'owner_changed':
      return detail?.to ? 'Assigned to a new owner' : 'Returned to the unassigned pile';
    case 'next_action_set':
      return detail?.to ? `Next action set for ${text(detail.to)}` : 'Next action date cleared';
    case 'lead_created':
      return 'Lead captured';
    default:
      return entry.type.replace(/_/g, ' ');
  }
}

function submissionHeading(type: AdminLeadDetail['type']): string {
  switch (type) {
    case 'CALCULATOR':
      return 'Calculator answers';
    case 'PROJECT':
      return 'Project brief';
    case 'AUDIT':
      return 'Audit request';
    case 'CAREERS':
      return 'Application';
    default:
      return 'What they sent';
  }
}

/** The fields that form actually captured, rather than every column the table has. */
function submissionRows(lead: AdminLeadDetail): [string, string][] {
  const answers = (lead.answers ?? {}) as Record<string, unknown>;
  const answer = (key: string): string => text(answers[key]);

  const common: [string, string][] = [
    ['Timeline', timelineLabel(lead.timeline)],
    ['Budget band', budgetLabel(lead.budgetBand)],
  ];

  switch (lead.type) {
    case 'AUDIT':
      return [
        ['Site URL', lead.siteUrl ?? '—'],
        ['Main concern', answer('mainConcern')],
        ['Competitor', answer('competitorUrl')],
        ['Message', lead.message ?? '—'],
      ];
    case 'PROJECT':
      return [
        ['Project type', lead.projectType ?? '—'],
        ['Summary', lead.message ?? '—'],
        ['Links', answer('projectLinks')],
        ...common,
      ];
    case 'CALCULATOR':
      return [
        ['Project type', answer('projectType') === '—' ? (lead.projectType ?? '—') : answer('projectType')],
        ['Primary goal', answer('goal')],
        ['Pages', answer('pages')],
        ['Integrations', answer('integrations')],
        ['Content ready', answer('contentReady')],
        ...common,
      ];
    case 'CONTACT':
      return [
        ['Enquiry type', lead.enquiryType?.name ?? '—'],
        ['Message', lead.message ?? '—'],
        ['Services', lead.serviceInterest.join(', ') || '—'],
      ];
    default:
      return [
        ['Message', lead.message ?? '—'],
        ['Services', lead.serviceInterest.join(', ') || '—'],
        ...common,
      ];
  }
}
