import Link from 'next/link';

const TABS = [
  { key: 'subscribers', href: '/admin/subscribers/', label: 'Subscribers' },
  { key: 'segments', href: '/admin/subscribers/segments/', label: 'Segments' },
  { key: 'suppression', href: '/admin/subscribers/suppression/', label: 'Suppression list' },
] as const;

/** The three screens of the subscribers module, one sidebar entry between them. */
export function AudienceTabs({ current }: { current: (typeof TABS)[number]['key'] }) {
  return (
    <nav aria-label="Subscribers module" className="mb-4 flex flex-wrap gap-x-5 border-b border-admin-line">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? 'page' : undefined}
          className={`-mb-px border-b-2 py-2 text-[12.5px] font-semibold ${
            current === tab.key
              ? 'border-admin-edge text-admin-ink'
              : 'border-transparent text-admin-body hover:text-admin-ink'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
