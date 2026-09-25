import type { AdminLeadList, AdminLeadListItem, AdminLeadQuery } from '@calwebtech/shared';
import Link from 'next/link';
import { SortIcon } from '../icons';
import { CHECK, TAG } from '../ui/styles';
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
  /** Its share while a lead is open and the secondary columns are gone. */
  compactWidth?: string;
  numeric?: boolean;
  /** Left out while a lead is open beside the table, which then has half the room. */
  secondary?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Name', width: 'w-[17%]', compactWidth: 'w-[31%]' },
  { key: 'company', label: 'Company', width: 'w-[14%]', secondary: true },
  { key: 'type', label: 'Form', width: 'w-[10%]', compactWidth: 'w-[15%]' },
  { key: 'service', label: 'Service or campaign', width: 'w-[16%]', secondary: true },
  { key: 'status', label: 'Status', width: 'w-[12%]', compactWidth: 'w-[17%]' },
  { key: 'owner', label: 'Owner', width: 'w-[11%]', compactWidth: 'w-[17%]' },
  { key: 'value', label: 'Budget', width: 'w-[8%]', numeric: true, secondary: true },
  { key: 'received', label: 'Received', width: 'w-[9%]', compactWidth: 'w-[14%]', numeric: true },
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
  const columns = openLeadId
    ? COLUMNS.filter((column) => !column.secondary).map((column) => ({ ...column, width: column.compactWidth ?? column.width }))
    : COLUMNS;
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">Leads, sortable by column</caption>
      <thead>
        <tr>
          <th scope="col" className="sticky top-0 z-10 w-12 bg-admin-sunken pl-5">
            {/*
              Selecting a page of rows is the one thing here that cannot be a link, so it is
              left to the bulk bar, which owns the selection.
            */}
            <span className="sr-only">Select</span>
          </th>
          {columns.map((column) => (
            <SortableHeader key={column.label} column={column} query={query} />
          ))}
        </tr>
      </thead>
      <tbody>
        {list.items.map((lead) => (
          <Row key={lead.id} lead={lead} query={query} open={lead.id === openLeadId} compact={openLeadId !== null} />
        ))}
      </tbody>
    </table>
  );
}

function SortableHeader({ column, query }: { column: Column; query: AdminLeadQuery }) {
  const active = column.key !== null && query.sort === column.key;
  const align = column.numeric ? 'justify-end text-right' : '';
  return (
    <th
      scope="col"
      aria-sort={active ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`sticky top-0 z-10 h-11 bg-admin-sunken px-3 text-left last:pr-5 ${column.width}`}
    >
      {column.key === null ? (
        <span className="text-[12px] font-semibold text-admin-muted">{column.label}</span>
      ) : (
        <Link
          href={sortUrl(query, column.key)}
          className={`flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap transition-colors duration-150 hover:text-ink-invert ${align} ${
            active ? 'text-ink-invert' : 'text-admin-muted'
          }`}
        >
          {column.label}
          {active ? <SortIcon direction={query.dir} className="size-3.5 text-admin-link" /> : null}
        </Link>
      )}
    </th>
  );
}

function Row({
  lead,
  query,
  open,
  compact,
}: {
  lead: AdminLeadListItem;
  query: AdminLeadQuery;
  open: boolean;
  compact: boolean;
}) {
  return (
    <tr
      className={`relative transition-colors duration-150 ${
        open ? 'bg-admin-hover shadow-[inset_3px_0_0_var(--color-gold-500)]' : 'hover:bg-admin-hover'
      }`}
    >
      <td className="h-[52px] border-t border-admin-line2 pl-5">
        <input type="checkbox" name="ids" value={lead.id} aria-label={`Select ${lead.name}`} className={`${CHECK} relative z-20`} />
      </td>

      <td className="truncate border-t border-admin-line2 px-3 text-[14px] font-semibold text-ink-invert">
        {/*
          `before:absolute before:inset-0` stretches this one link across the whole row, so a
          click anywhere opens the panel without a row-level click handler.
        */}
        <Link
          href={leadPanelUrl(query, lead.id)}
          aria-current={open ? 'true' : undefined}
          className="before:absolute before:inset-0 hover:underline"
        >
          {lead.name}
        </Link>
      </td>

      {compact ? null : <Cell title={lead.company}>{lead.company ?? '—'}</Cell>}

      <td className="border-t border-admin-line2 px-3">
        <span className={TAG}>{typeLabel(lead.type)}</span>
      </td>

      {compact ? null : <Cell title={lead.source}>{lead.source ?? '—'}</Cell>}

      <td className="border-t border-admin-line2 px-3">
        <StatusPill status={lead.status} />
      </td>

      <Cell muted={!lead.owner}>{lead.owner?.name ?? 'Unassigned'}</Cell>
      {compact ? null : <Cell numeric>{budgetShort(lead.budgetBand)}</Cell>}
      <Cell numeric last>
        {received(lead.createdAt)}
      </Cell>
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
  muted,
  last,
  title,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  muted?: boolean;
  last?: boolean;
  title?: string | null;
}) {
  return (
    <td
      title={title ?? undefined}
      className={`truncate border-t border-admin-line2 px-3 text-[14px] ${muted ? 'text-admin-muted' : 'text-ink-invert-muted'} ${
        numeric ? 'text-right tabular-nums' : ''
      } ${last ? 'pr-5' : ''}`}
    >
      {children}
    </td>
  );
}
