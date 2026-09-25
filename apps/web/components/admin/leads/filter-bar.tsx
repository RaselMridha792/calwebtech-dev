import {
  LEAD_CHANNELS,
  LEAD_DATE_RANGES,
  LEAD_TYPE_LABELS,
  LEAD_TYPES,
  type AdminLeadFilterOptions,
  type AdminLeadQuery,
} from '@calwebtech/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SearchIcon } from '../icons';
import { INPUT, LINK } from '../ui/styles';
import { AutoSubmit } from './auto-submit';

/**
 * The filter bar. A plain GET form, so the whole view lives in the URL: it can be
 * bookmarked, shared and reached with the back button, and the table stays a server
 * component with no state to hydrate.
 *
 * Status is chosen by the tabs above the bar, so it rides along here as hidden fields, as
 * the sort does: changing a filter should neither reset the tab nor reorder the table.
 * Submitting drops `page`, so narrowing the view always lands on the first page.
 */
export function FilterBar({
  query,
  options,
}: {
  query: AdminLeadQuery;
  options: AdminLeadFilterOptions;
}) {
  const type = query.type?.[0] ?? '';

  return (
    <form role="search" method="get" action="/admin/leads/" className="flex flex-wrap items-center gap-2">
      <AutoSubmit />
      <input type="hidden" name="sort" value={query.sort} />
      <input type="hidden" name="dir" value={query.dir} />
      {(query.status ?? []).map((status) => (
        <input key={status} type="hidden" name="status" value={status} />
      ))}
      {query.includeClosed ? <input type="hidden" name="includeClosed" value="true" /> : null}

      <div className="relative w-full sm:w-[260px]">
        <label htmlFor="filter-search" className="sr-only">
          Search leads
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-admin-muted" />
        <input
          id="filter-search"
          name="search"
          type="search"
          defaultValue={query.search ?? ''}
          placeholder="Name, company or email"
          data-autosubmit="skip"
          className={`${INPUT} pl-9 ${query.search ? 'border-admin-edge' : ''}`}
        />
      </div>

      <Pick label="Form" id="filter-type" name="type" value={type} lit={Boolean(type)}>
        <option value="">All</option>
        {LEAD_TYPES.map((value) => (
          <option key={value} value={value}>
            {LEAD_TYPE_LABELS[value]}
          </option>
        ))}
      </Pick>

      <Pick label="Owner" id="filter-owner" name="owner" value={query.owner ?? ''} lit={Boolean(query.owner)}>
        <option value="">Anyone</option>
        <option value="me">Me</option>
        <option value="unassigned">Unassigned</option>
        {options.owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name}
          </option>
        ))}
      </Pick>

      <Pick
        label="Received"
        id="filter-received"
        name="received"
        value={query.received ?? 'last-90-days'}
        lit={Boolean(query.received && query.received !== 'last-90-days')}
      >
        {LEAD_DATE_RANGES.map((range) => (
          <option key={range.value} value={range.value}>
            {range.label}
          </option>
        ))}
      </Pick>

      <Pick label="Source" id="filter-source" name="source" value={query.source ?? ''} lit={Boolean(query.source)}>
        <option value="">All</option>
        {LEAD_CHANNELS.map((channel) => (
          <option key={channel.value} value={channel.value}>
            {channel.label}
          </option>
        ))}
      </Pick>

      <Pick label="Service" id="filter-service" name="serviceSlug" value={query.serviceSlug ?? ''} lit={Boolean(query.serviceSlug)}>
        <option value="">All</option>
        {options.services.map((service) => (
          <option key={service.slug} value={service.slug}>
            {service.title}
          </option>
        ))}
      </Pick>

      <Pick label="Enquiry" id="filter-enquiry" name="enquiry" value={query.enquiry ?? ''} lit={Boolean(query.enquiry)}>
        <option value="">All</option>
        {options.enquiryTypes.map((enquiry) => (
          <option key={enquiry.slug} value={enquiry.slug}>
            {enquiry.name}
          </option>
        ))}
      </Pick>

      {/* Reachable by keyboard and the only way to apply the filters without JavaScript. */}
      <button type="submit" className="sr-only focus:not-sr-only focus:rounded-lg focus:px-3 focus:py-2 focus:text-ink-invert">
        Apply filters
      </button>

      <Link href="/admin/leads/" className={`${LINK} ml-1 text-[13.5px]`}>
        Clear all
      </Link>
    </form>
  );
}

/**
 * A select with its label inside the same pill, so the bar reads as a sentence of choices
 * ("Owner: Anyone") and every control keeps a real, visible label. A lit pill is one that
 * narrows the view.
 */
function Pick({
  label,
  id,
  name,
  value,
  lit,
  children,
}: {
  label: string;
  id: string;
  name: string;
  value: string;
  lit: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex h-10 items-center rounded-lg border transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-admin-focus pointer-coarse:h-11 ${
        lit ? 'border-admin-edge bg-admin-nav' : 'border-admin-line hover:border-admin-edge'
      }`}
    >
      <label htmlFor={id} className="pl-3 text-[13px] text-admin-muted">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value}
        className="h-full max-w-[180px] cursor-pointer truncate rounded-lg bg-transparent pr-2 pl-1.5 text-[13.5px] font-semibold text-ink-invert outline-none focus-visible:outline-none"
      >
        {children}
      </select>
    </div>
  );
}
