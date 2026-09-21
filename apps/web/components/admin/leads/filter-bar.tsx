import {
  LEAD_CHANNELS,
  LEAD_DATE_RANGES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_TYPE_LABELS,
  LEAD_TYPES,
  type AdminLeadFilterOptions,
  type AdminLeadQuery,
} from '@calwebtech/shared';
import Link from 'next/link';
import { AutoSubmit } from './auto-submit';

/**
 * The filter bar. A plain GET form, so the whole view lives in the URL: it can be
 * bookmarked, shared and reached with the back button, and the table stays a server
 * component with no state to hydrate.
 *
 * Submitting drops `page`, so narrowing the view always lands on the first page. The sort
 * is carried through, because changing a filter should not also reorder the table.
 */
export function FilterBar({
  query,
  options,
}: {
  query: AdminLeadQuery;
  options: AdminLeadFilterOptions;
}) {
  const type = query.type?.[0] ?? '';
  const status = query.status?.[0] ?? '';

  return (
    <form
      role="search"
      method="get"
      action="/admin/leads/"
      className="flex shrink-0 flex-wrap items-end gap-2.5 border-y border-admin-line bg-admin-surface px-4 py-2.5"
    >
      <AutoSubmit />
      <input type="hidden" name="sort" value={query.sort} />
      <input type="hidden" name="dir" value={query.dir} />

      <Field label="Search" htmlFor="filter-search" width="w-[190px]">
        <input
          id="filter-search"
          name="search"
          type="search"
          defaultValue={query.search ?? ''}
          placeholder="Name, company, email"
          data-autosubmit="skip"
          className={`${INPUT} bg-admin-sunken ${query.search ? LIT : ''}`}
        />
      </Field>

      <Field label="Type" htmlFor="filter-type" width="w-[116px]">
        <select id="filter-type" name="type" defaultValue={type} className={`${INPUT} ${type ? LIT : ''}`}>
          <option value="">All types</option>
          {LEAD_TYPES.map((value) => (
            <option key={value} value={value}>
              {LEAD_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Status" htmlFor="filter-status" width="w-[128px]">
        <select id="filter-status" name="status" defaultValue={status} className={`${INPUT} ${status ? LIT : ''}`}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Owner" htmlFor="filter-owner" width="w-[128px]">
        <select id="filter-owner" name="owner" defaultValue={query.owner ?? ''} className={`${INPUT} ${query.owner ? LIT : ''}`}>
          <option value="">Anyone</option>
          <option value="me">Me</option>
          <option value="unassigned">Unassigned</option>
          {options.owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Received" htmlFor="filter-received" width="w-[124px]">
        <select
          id="filter-received"
          name="received"
          defaultValue={query.received ?? 'last-90-days'}
          className={`${INPUT} ${query.received && query.received !== 'last-90-days' ? LIT : ''}`}
        >
          {LEAD_DATE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Source" htmlFor="filter-source" width="w-[132px]">
        <select id="filter-source" name="source" defaultValue={query.source ?? ''} className={`${INPUT} ${query.source ? LIT : ''}`}>
          <option value="">All sources</option>
          {LEAD_CHANNELS.map((channel) => (
            <option key={channel.value} value={channel.value}>
              {channel.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Service" htmlFor="filter-service" width="w-[150px]">
        <select
          id="filter-service"
          name="serviceSlug"
          defaultValue={query.serviceSlug ?? ''}
          className={`${INPUT} ${query.serviceSlug ? LIT : ''}`}
        >
          <option value="">All services</option>
          {options.services.map((service) => (
            <option key={service.slug} value={service.slug}>
              {service.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Enquiry" htmlFor="filter-enquiry" width="w-[134px]">
        <select
          id="filter-enquiry"
          name="enquiry"
          defaultValue={query.enquiry ?? ''}
          className={`${INPUT} ${query.enquiry ? LIT : ''}`}
        >
          <option value="">All enquiries</option>
          {options.enquiryTypes.map((enquiry) => (
            <option key={enquiry.slug} value={enquiry.slug}>
              {enquiry.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Reachable by keyboard and the only way to apply the filters without JavaScript. */}
      <button type="submit" className="sr-only">
        Apply filters
      </button>

      <Link href="/admin/leads/" className="h-[30px] self-end text-[12.5px] font-semibold text-admin-link hover:underline">
        Clear all
      </Link>
    </form>
  );
}

const INPUT =
  'h-[30px] w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus';

/** The one affordance that says this view is narrowed. */
const LIT = 'border-admin-edge';

function Field({
  label,
  htmlFor,
  width,
  children,
}: {
  label: string;
  htmlFor: string;
  width: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-[3px] ${width}`}>
      <label htmlFor={htmlFor} className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
