import { adminLeadListSchema, canRead, type AdminModule, type AdminUser } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import {
  AuditIcon,
  BookingsIcon,
  CampaignsIcon,
  ContentIcon,
  DashboardIcon,
  LeadsIcon,
  MediaIcon,
  RoutingIcon,
  SectionsIcon,
  SettingsIcon,
  SubscribersIcon,
  TeamIcon,
} from '@/components/admin/icons';
import { Sidebar, type NavGroup, type NavItem } from '@/components/admin/sidebar';
import { TopBar } from '@/components/admin/top-bar';
import { Wordmark } from '@/components/admin/wordmark';
import { adminGet } from '@/lib/admin/api';
import { requireAdmin } from '@/lib/admin/session';

/**
 * The signed-in shell: sidebar, top bar, and the column everything else renders into
 * (docs/12-admin-dashboard.md, "Shell").
 *
 * Sign-in sits outside this layout, in its own route group, because there is nothing to put
 * in a sidebar for someone who is not signed in.
 */

interface ModuleRoute {
  module: AdminModule;
  href: string;
  label: string;
  icon: ReactNode;
}

const GROUPS: { label: string; routes: ModuleRoute[] }[] = [
  {
    label: 'Overview',
    routes: [{ module: 'overview', href: '/admin/', label: 'Dashboard', icon: <DashboardIcon /> }],
  },
  {
    label: 'Sales',
    routes: [
      { module: 'leads', href: '/admin/leads/', label: 'Leads', icon: <LeadsIcon /> },
      { module: 'bookings', href: '/admin/bookings/', label: 'Bookings', icon: <BookingsIcon /> },
      { module: 'subscribers', href: '/admin/subscribers/', label: 'Subscribers', icon: <SubscribersIcon /> },
      { module: 'campaigns', href: '/admin/campaigns/', label: 'Campaigns', icon: <CampaignsIcon /> },
    ],
  },
  {
    label: 'Content',
    routes: [
      { module: 'content', href: '/admin/content/', label: 'Services', icon: <ContentIcon /> },
      { module: 'media', href: '/admin/media/', label: 'Media', icon: <MediaIcon /> },
      { module: 'pageSections', href: '/admin/page-sections/', label: 'Page sections', icon: <SectionsIcon /> },
    ],
  },
  {
    label: 'Site',
    routes: [{ module: 'formsRouting', href: '/admin/forms/', label: 'Forms and routing', icon: <RoutingIcon /> }],
  },
  {
    label: 'Admin',
    routes: [
      { module: 'team', href: '/admin/team/', label: 'Team and roles', icon: <TeamIcon /> },
      { module: 'auditLog', href: '/admin/audit/', label: 'Audit log', icon: <AuditIcon /> },
    ],
  },
];

const SETTINGS: ModuleRoute = {
  module: 'settings',
  href: '/admin/settings/',
  label: 'Settings',
  icon: <SettingsIcon />,
};

/** Path segment to page name, for the breadcrumb. One list, not two. */
const CRUMB_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    [...GROUPS.flatMap((group) => group.routes), SETTINGS].map((route) => [
      route.href.replace(/^\/admin\/?/, '').replace(/\/$/, ''),
      route.label,
    ]),
  ),
  // Screens inside a module that are not records of it.
  'subscribers/segments': 'Segments',
  'subscribers/suppression': 'Suppression list',
};

export default async function AdminShellLayout({ children }: LayoutProps<'/admin'>) {
  const user = await requireAdmin();
  const leadCount = await unassignedNewCount(user);

  const groups: NavGroup[] = GROUPS.map((group) => ({
    label: group.label,
    items: group.routes.filter((route) => canRead(user.role, route.module)).map((route) => toItem(route, leadCount)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:pl-[246px]">
      <TopBar
        menu={<Sidebar groups={groups} footer={toItem(SETTINGS)} brand={<Wordmark />} />}
        name={user.name}
        role={user.role.toLowerCase()}
        labels={CRUMB_LABELS}
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
