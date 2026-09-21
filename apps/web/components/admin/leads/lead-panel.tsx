import type { AdminLeadDetail, AdminLeadQuery, AdminLeadTimelineEntry } from '@calwebtech/shared';
import Link from 'next/link';
import { CloseIcon } from '../icons';
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
  return (
    <aside
      aria-label="Lead detail"
      className={
        full
          ? 'flex min-h-0 flex-1 flex-col bg-admin-surface'
          : 'flex min-h-0 w-full shrink-0 flex-col border-admin-line bg-admin-surface lg:w-[428px] lg:border-l'
      }
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-admin-line px-[18px] py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[18px] font-bold tracking-[-0.02em] text-admin-ink">{lead.name}</h2>
            <StatusPill status={lead.status} />
          </div>
          <p className="mt-1 text-[12.5px] text-admin-body">
            {[lead.company, typeLabel(lead.type), `received ${receivedLong(lead.createdAt)}`, lead.id]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {full ? null : (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/admin/leads/${encodeURIComponent(lead.id)}/`}
              className="flex h-[29px] items-center rounded-[4px] border border-admin-line px-2.5 text-[12px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
            >
              Open full record
            </Link>
            <Link
              href={leadsUrl(query)}
              aria-label="Close lead detail"
              className="flex size-[29px] items-center justify-center rounded-[4px] border border-admin-line text-admin-body hover:border-admin-focus hover:text-admin-ink"
            >
              <CloseIcon className="size-3.5" />
            </Link>
          </div>
        )}
      </header>

      <div className={`min-h-0 flex-1 overflow-auto px-[18px] pb-7 ${full ? 'mx-auto w-full max-w-[860px]' : ''}`}>
        <Section heading="Identity" id="lead-identity">
          <Fields
            rows={[
              ['Name', lead.name],
              ['Email', lead.email],
              ['Phone', lead.phone ?? '—'],
              ['Company', lead.company ?? '—'],
              ['Value band', budgetLabel(lead.budgetBand)],
            ]}
          />
          {lead.contact ? (
            <p className="mt-2.5 rounded-[4px] bg-admin-sunken px-2.5 py-2 text-[11.5px] text-admin-body">
              Linked to one contact — {lead.contact.submissions}{' '}
              {lead.contact.submissions === 1 ? 'submission' : 'submissions'} from this person resolve to the same
              record, so they are not counted twice.
            </p>
          ) : null}
        </Section>

        <Section heading={submissionHeading(lead.type)} id="lead-submission">
          <Fields rows={submissionRows(lead)} />
        </Section>

        <Section heading="Attribution trail" id="lead-attribution">
          {lead.attribution ? (
            <>
              <div className="flex gap-2.5">
                <TouchCard label="First touch" utm={lead.attribution.firstTouch} fallback={channelLabel(lead.channel)} />
                <TouchCard label="Last touch" utm={lead.attribution.lastTouch} fallback={channelLabel(lead.channel)} />
              </div>
              <div className="mt-2.5">
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
            <p className="text-[12.5px] text-admin-body">
              Nothing was recorded for this submission, which is what a direct visit with no campaign looks like.
            </p>
          )}
        </Section>

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

        <Section heading="Timeline" id="lead-timeline">
          {lead.entries.length === 0 ? (
            <p className="text-[12.5px] text-admin-body">Nothing has happened to this lead since it arrived.</p>
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
            <p className="text-[12.5px] text-admin-body">
              No delivery events yet. Nothing is recorded here until the sending domain and its webhooks are live.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lead.emails.map((email) => (
                <li key={email.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] text-admin-ink">{email.subject}</span>
                    <span className="block text-[11px] text-admin-muted">
                      {receivedLong(email.occurredAt)} · to {email.to}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-admin-body">
                    <span aria-hidden className="size-2 rounded-full bg-result" />
                    {email.state}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </aside>
  );
}

function Section({ heading, id, children }: { heading: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-b border-admin-line py-4 last:border-b-0">
      <h3 id={id} className="mb-2.5 text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">
        {heading}
      </h3>
      {children}
    </section>
  );
}

function Fields({ rows, breakAll }: { rows: [string, string][]; breakAll?: boolean }) {
  return (
    <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-[7px] text-[12.5px]">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-admin-muted">{term}</dt>
          <dd className={`text-admin-ink ${breakAll ? 'break-all' : ''}`}>{value}</dd>
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
    <div className="flex-1 rounded-[4px] bg-admin-sunken px-2.5 py-2.5">
      <p className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">{label}</p>
      <p className="mt-1 text-[12.5px] font-semibold text-admin-ink">{utm?.source ?? fallback}</p>
      <p className="text-[11px] text-admin-muted">
        {[utm?.medium, utm?.campaign].filter(Boolean).join(' · ') || 'no campaign recorded'}
      </p>
    </div>
  );
}

/** A note is a square mark, an activity a round one, so the two read apart at a glance. */
function TimelineRow({ entry }: { entry: AdminLeadTimelineEntry }) {
  const note = entry.kind === 'note';
  return (
    <li className="flex gap-2.5 border-t border-admin-mist py-2.5 first:border-t-0">
      <span
        aria-hidden
        className={`mt-1.5 size-[7px] shrink-0 ${note ? 'rounded-[1px] bg-primary' : 'rounded-full bg-admin-body'}`}
      />
      <span className="min-w-0">
        <span className="block text-[12.5px] leading-[19px] text-admin-ink">
          {note ? entry.body : activityText(entry)}
        </span>
        <span className="block text-[11px] text-admin-muted">
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
      return 'Submission';
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
        ['Enquiry type', answer('enquiryType')],
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
