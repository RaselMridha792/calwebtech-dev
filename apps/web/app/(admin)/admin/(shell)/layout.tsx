import { adminLeadListSchema, canRead, canWrite, type AdminModule, type AdminUser } from '@calwebtech/shared';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import type { PaletteCommand } from '@/components/admin/command-palette';
import {
  AuditIcon,
  BookingsIcon,
  CampaignsIcon,
  CaseStudiesIcon,
  ContentIcon,
  DashboardIcon,
  IndustriesIcon,
  LeadsIcon,
  MediaIcon,
  PageCopyIcon,
  RoutingIcon,
  SectionsIcon,
  SettingsIcon,
  SubscribersIcon,
  TeamIcon,
} from '@/components/admin/icons';
import { Sidebar, type NavGroup, type NavItem } from '@/components/admin/sidebar';
import { SIDEBAR_COOKIE } from '@/components/admin/sidebar-cookie';
import { TopBar } from '@/components/admin/top-bar';
import { Logo } from '@/components/ui/logo';
import { adminGet } from '@/lib/admin/api';
import { requireAdmin } from '@/lib/admin/session';

/**
 * The signed-in shell: sidebar, top bar, and the column everything else renders into
 * (docs/12-admin-dashboard.md, "Shell"; docs/08-decisions.md, 63).
 *
 * Sign-in sits outside this layout, in its own route group, because there is nothing to put
 * in a sidebar for someone who is not signed in.
 */

interface ModuleRoute {
  module: AdminModule;
  href: string;
  label: string;
  icon: ReactNode;
  /** Other words for it, for the search palette. */
  keywords?: string;
}

const GROUPS: { label: string | null; routes: ModuleRoute[] }[] = [
  {
    label: null,
    routes: [{ module: 'overview', href: '/admin/', label: 'Dashboard', icon: <DashboardIcon />, keywords: 'overview home' }],
  },
  {
    label: 'Sales',
    routes: [
      { module: 'leads', href: '/admin/leads/', label: 'Leads', icon: <LeadsIcon />, keywords: 'inbox enquiries forms' },
      { module: 'bookings', href: '/admin/bookings/', label: 'Bookings', icon: <BookingsIcon />, keywords: 'calls calendar' },
      { module: 'subscribers', href: '/admin/subscribers/', label: 'Subscribers', icon: <SubscribersIcon />, keywords: 'audience newsletter' },
      { module: 'campaigns', href: '/admin/campaigns/', label: 'Campaigns', icon: <CampaignsIcon />, keywords: 'email newsletter send' },
    ],
  },
  {
    label: 'Content',
    routes: [
      { module: 'content', href: '/admin/content/', label: 'Services', icon: <ContentIcon />, keywords: 'pages content' },
      { module: 'content', href: '/admin/industries/', label: 'Industries', icon: <IndustriesIcon />, keywords: 'sectors' },
      { module: 'content', href: '/admin/case-studies/', label: 'Case studies', icon: <CaseStudiesIcon />, keywords: 'work projects portfolio' },
      { module: 'content', href: '/admin/page-copy/', label: 'Page copy', icon: <PageCopyIcon />, keywords: 'homepage words text' },
      { module: 'media', href: '/admin/media/', label: 'Media', icon: <MediaIcon />, keywords: 'images upload photos' },
      { module: 'pageSections', href: '/admin/page-sections/', label: 'Page sections', icon: <SectionsIcon />, keywords: 'announcement' },
    ],
  },
  {
    label: 'Site',
    routes: [
      { module: 'formsRouting', href: '/admin/forms/', label: 'Forms and routing', icon: <RoutingIcon />, keywords: 'enquiry mailbox' },
      { module: 'settings', href: '/admin/settings/', label: 'Settings', icon: <SettingsIcon />, keywords: 'contact search engines indexing' },
    ],
  },
  {
    label: 'Admin',
    routes: [
      { module: 'team', href: '/admin/team/', label: 'Team and roles', icon: <TeamIcon />, keywords: 'users people invite' },
      { module: 'auditLog', href: '/admin/audit/', label: 'Audit log', icon: <AuditIcon />, keywords: 'history changes' },
    ],
  },
];

/** Screens inside a module that are not records of it, for the breadcrumb and the palette. */
const INNER: { module: AdminModule; href: string; label: string; keywords?: string }[] = [
  { module: 'bookings', href: '/admin/bookings/availability/', label: 'Availability', keywords: 'hours week days off' },
  { module: 'subscribers', href: '/admin/subscribers/segments/', label: 'Segments', keywords: 'audience rules' },
  { module: 'subscribers', href: '/admin/subscribers/suppression/', label: 'Suppression list', keywords: 'unsubscribed bounced blocked' },
];

/** What the palette can create, each behind the write access its screen needs. */
const CREATE: { module: AdminModule; href: string; label: string; keywords?: string }[] = [
  { module: 'content', href: '/admin/content/services/new/', label: 'New service', keywords: 'add page' },
  { module: 'content', href: '/admin/industries/new/', label: 'New industry', keywords: 'add' },
  { module: 'content', href: '/admin/case-studies/new/', label: 'New case study', keywords: 'add project work' },
  { module: 'campaigns', href: '/admin/campaigns/new/', label: 'New campaign', keywords: 'add email send' },
  { module: 'subscribers', href: '/admin/subscribers/segments/new/', label: 'New segment', keywords: 'add audience' },
];

const path = (href: string): string => href.replace(/^\/admin\/?/, '').replace(/\/$/, '');

/**
 * Path segment to page name, for the breadcrumb. One list, not two. An empty name leaves a
 * segment out: `content/services` only groups the service records under Services.
 */
const CRUMB_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    [...GROUPS.flatMap((group) => group.routes), ...INNER]
      .filter((route) => route.href !== '/admin/')
      .map((route) => [path(route.href), route.label]),
  ),
  'content/services': '',
};

export default async function AdminShellLayout({ children }: LayoutProps<'/admin'>) {
  const user = await requireAdmin();
  const [leadCount, jar] = await Promise.all([unassignedNewCount(user), cookies()]);
  const rail = jar.get(SIDEBAR_COOKIE)?.value === 'rail';

  const groups: NavGroup[] = GROUPS.map((group) => ({
    label: group.label,
    items: group.routes.filter((route) => canRead(user.role, route.module)).map((route) => toItem(route, leadCount)),
  })).filter((group) => group.items.length > 0);

  const commands: PaletteCommand[] = [
    ...[...GROUPS.flatMap((group) => group.routes), ...INNER]
      .filter((route) => canRead(user.role, route.module))
      .map((route) => ({ label: route.label, href: route.href, group: 'Go to' as const, keywords: route.keywords })),
    ...CREATE.filter((action) => canWrite(user.role, action.module)).map((action) => ({
      label: action.label,
      href: action.href,
      group: 'Create' as const,
      keywords: action.keywords,
    })),
  ];
  const searchable = [
    ...(canRead(user.role, 'leads') ? [{ label: 'leads', href: '/admin/leads/' }] : []),
    ...(canRead(user.role, 'subscribers') ? [{ label: 'subscribers', href: '/admin/subscribers/' }] : []),
  ];

  return (
    // `:has()` reads the sidebar's rail state, so the column narrows with it and no script
    // has to tell this element.
    <div className="flex h-dvh flex-col overflow-hidden lg:pl-64 lg:has-[nav[data-rail]]:pl-[76px]">
      <a
        href="#admin-main"
        className="sr-only z-[60] rounded-lg bg-gold-500 px-4 py-2.5 font-bold text-on-gold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <TopBar
        menu={
          <Sidebar
            groups={groups}
            brand={<Logo tone="dark" layout="compact" height={30} priority />}
            mark={<Logo tone="dark" layout="mark" height={32} />}
            user={{ name: user.name, email: user.email, role: user.role.toLowerCase() }}
            initialRail={rail}
          />
        }
        labels={CRUMB_LABELS}
        commands={commands}
        searchable={searchable}
      />
      {children}
    </div>
  );
}

function toItem(route: ModuleRoute, leadCount?: number): NavItem {
  return {
    href: route.href,
    label: route.label,
    icon: route.icon,
    ...(route.module === 'leads' && leadCount !== undefined ? { count: leadCount } : {}),
  };
}

/**
 * The badge on Leads. The design puts the current result count there; a layout cannot see
 * the page's filters, so it shows the number that is actionable whatever the filters are —
 * the leads nobody owns yet.
 */
async function unassignedNewCount(user: AdminUser): Promise<number | undefined> {
  if (!canRead(user.role, 'leads')) return undefined;
  try {
    const list = await adminGet('/admin/leads?pageSize=1', adminLeadListSchema);
    return list.unassignedNew;
  } catch {
    // A badge is never worth failing the whole shell for.
    return undefined;
  }
}
