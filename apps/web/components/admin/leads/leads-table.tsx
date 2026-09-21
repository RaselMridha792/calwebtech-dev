import type { AdminLeadList, AdminLeadListItem, AdminLeadQuery } from '@calwebtech/shared';
import Link from 'next/link';
import { SortIcon } from '../icons';
import { budgetShort, received, typeLabel } from './format';
import { leadPanelUrl, sortUrl } from './query-url';
import { StatusPill } from './status-pill';

/**
 * The inbox table (docs/12-admin-dashboard.md, module 2).
 *
 * Server-rendered, including the sort links and the row links: the whole view is its URL,
 * so nothing here hydrates. The only client code on the screen is the bulk bar, which
 * counts the checkboxes this table renders.
 *
 * The row link is stretched over the row with a pseudo-element rather than a click handler,
 * so clicking anywhere in the row opens the panel with no JavaScript, and the name is still
 * a real link for anyone using the keyboard or a screen reader.
 */

interface Column {
  key: AdminLeadQuery['sort'] | null;
  label: string;
  width: string;
  numeric?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'received', label: 'Received', width: 'w-[9%]', numeric: true },
  { key: 'name', label: 'Name', width: 'w-[15%]' },
  { key: 'company', label: 'Company', width: 'w-[13%]' },
  { key: 'type', label: 'Type', width: 'w-[8%]' },
  { key: 'service', label: 'Service or campaign', width: 'w-[17%]' },
  { key: 'status', label: 'Status', width: 'w-[12%]' },
  { key: 'owner', label: 'Owner', width: 'w-[11%]' },
  { key: 'value', label: 'Value band', width: 'w-[9%]', numeric: true },
];

export function LeadsTable({
  list,
  query,
  openLeadId,
}: {
  list: AdminLeadList;
  query: AdminLeadQuery;
  openLeadId: string | null;
}) {
  return (
    <table role="grid" className="w-full table-fixed border-collapse">
      <caption className="sr-only">Leads, sortable by column</caption>
      <thead>
        <tr>
          <th scope="col" className="sticky top-0 z-10 w-[3%] border-b border-admin-line bg-admin-sunken px-[10px]">
            {/*
              Selecting a page of rows is the one thing here that cannot be a link, so it is
              left to the bulk bar, which owns the selection.
            */}
            <span className="sr-only">Select</span>
          </th>
          {COLUMNS.map((column) => (
            <SortableHeader key={column.label} column={column} query={query} />
          ))}
        </tr>
      </thead>
      <tbody>
        {list.items.map((lead) => (
          <Row key={lead.id} lead={lead} query={query} open={lead.id === openLeadId} />
        ))}
      </tbody>
    </table>
  );
}

function SortableHeader({ column, query }: { column: Column; query: AdminLeadQuery }) {
  const active = column.key !== null && query.sort === column.key;
  return (
    <th
      scope="col"
      aria-sort={active ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`sticky top-0 z-10 h-8 border-b border-admin-line bg-admin-sunken px-[10px] text-left ${column.width}`}
    >
      {column.key === null ? (
        <span className="text-[10px] font-bold tracking-[0.1em] text-admin-body uppercase">{column.label}</span>
      ) : (
        <Link
          href={sortUrl(query, column.key)}
          className="flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-admin-body uppercase hover:text-admin-ink"
        >
          {column.label}
          {active ? <SortIcon direction={query.dir} className="size-3 text-admin-link" /> : null}
        </Link>
      )}
    </th>
  );
}

function Row({ lead, query, open }: { lead: AdminLeadListItem; query: AdminLeadQuery; open: boolean }) {
  return (
    <tr className={`relative h-[30px] ${open ? 'bg-admin-mist' : 'hover:bg-admin-hover'}`}>
      <td className="border-b border-admin-mist px-[10px]">
        <input
          type="checkbox"
          name="ids"
          value={lead.id}
          aria-label={`Select ${lead.name}`}
          className="relative z-20 size-3.5 accent-admin-edge"
        />
      </td>

      <Cell numeric>{received(lead.createdAt)}</Cell>

      <td className="truncate border-b border-admin-mist px-[10px] text-[12.5px] font-semibold text-admin-ink">
        {/*
          `before:absolute before:inset-0` stretches this one link across the whole row, so a
          click anywhere opens the panel without a row-level click handler.
        */}
        <Link href={leadPanelUrl(query, lead.id)} className="before:absolute before:inset-0 hover:underline">
          {lead.name}
        </Link>
      </td>

      <Cell title={lead.company}>{lead.company ?? '—'}</Cell>

      <td className="border-b border-admin-mist px-[10px]">
        <span className="inline-block rounded-[3px] border border-admin-line px-1.5 py-px text-[10.5px] font-semibold tracking-[0.04em] text-admin-body uppercase">
          {typeLabel(lead.type)}
        </span>
      </td>

      <Cell title={lead.source}>{lead.source ?? '—'}</Cell>

      <td className="border-b border-admin-mist px-[10px]">
        <StatusPill status={lead.status} />
      </td>

      <Cell>{lead.owner?.name ?? 'Unassigned'}</Cell>
      <Cell numeric>{budgetShort(lead.budgetBand)}</Cell>
    </tr>
  );
}

/**
 * Cells truncate rather than wrap, which keeps the row height honest; the full value is
 * always one click away in the panel, and a `title` carries it for a pointer.
 */
function Cell({
  children,
  numeric,
  title,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  title?: string | null;
}) {
  return (
    <td
      title={title ?? undefined}
      className={`truncate border-b border-admin-mist px-[10px] text-[12.5px] text-admin-body ${
        numeric ? 'tabular-nums' : ''
      }`}
    >
      {children}
    </td>
  );
}
