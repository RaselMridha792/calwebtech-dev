import type { SVGProps } from 'react';

/**
 * The admin's navigation glyphs, drawn here rather than pulled from an icon package: the
 * marketing side already hand-writes its own (components/ui/icons.tsx), and a dependency
 * for twelve shapes would be the largest thing in the bundle.
 *
 * All are 16-viewBox stroke glyphs, and all are decorative: every control that shows one
 * also carries its own text, visible or for a screen reader.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

function Glyph({ d, ...props }: IconProps & { d: string }) {
  return (
    <svg viewBox="0 0 16 16" {...base} {...props}>
      <path d={d} />
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return <Glyph {...props} d="M2.5 13.5v-5m3.5 5v-9m3.5 9v-6m3.5 6v-11" />;
}

export function LeadsIcon(props: IconProps) {
  return <Glyph {...props} d="M2 9.5h3l1 2h4l1-2h3M2 9.5 3.8 3.2A1 1 0 0 1 4.8 2.5h6.4a1 1 0 0 1 1 .7L14 9.5v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />;
}

export function BookingsIcon(props: IconProps) {
  return <Glyph {...props} d="M3 3.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM2 6.5h12M5.5 2v3m5-3v3" />;
}

export function SubscribersIcon(props: IconProps) {
  return <Glyph {...props} d="M6 7.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zM1.5 13.5v-1a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v1M11 3.2a2.25 2.25 0 0 1 0 4.35M14.5 13.5v-1a3 3 0 0 0-2.2-2.9" />;
}

export function CampaignsIcon(props: IconProps) {
  return <Glyph {...props} d="M14 2 1.5 7.2l5 2.1m7.5-7.3-8 12-1.5-4.7m9.5-7.3-9.5 7.3" />;
}

export function ContentIcon(props: IconProps) {
  return <Glyph {...props} d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5zM9 1.5v4h4M5.5 8.5h5m-5 2.5h5" />;
}

export function IndustriesIcon(props: IconProps) {
  return <Glyph {...props} d="M2 14V6.5l4 2.5V6.5l4 2.5V3.5h4V14zM2 14h12M11.5 6h1m-1 2.5h1m-8 3h1m2 0h1m2 0h1" />;
}

export function CaseStudiesIcon(props: IconProps) {
  return <Glyph {...props} d="M2.5 5h11a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3.5 0V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5M1.5 8.5h13" />;
}

export function PageCopyIcon(props: IconProps) {
  return <Glyph {...props} d="M3 3h10M3 6h10M3 9h7M3 12h5m5.5-2.5-3 3-.5 1.5 1.5-.5 3-3z" />;
}

export function MediaIcon(props: IconProps) {
  return <Glyph {...props} d="M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm-1 8 3-2.5 3 2.4 2.5-2.4L14 10.5M6 6a.75.75 0 1 1-1.5 0A.75.75 0 0 1 6 6z" />;
}

export function SectionsIcon(props: IconProps) {
  return <Glyph {...props} d="M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM2 6h12M6.5 6v8" />;
}

export function RoutingIcon(props: IconProps) {
  return <Glyph {...props} d="M4.5 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm0 0v7m0 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7-7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm0 0c0 2.5-2 3.5-4 4" />;
}

export function TeamIcon(props: IconProps) {
  return <Glyph {...props} d="M8 8a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 8 8zm-5 6v-1a3.5 3.5 0 0 1 3.5-3.5h3A3.5 3.5 0 0 1 13 13v1" />;
}

export function AuditIcon(props: IconProps) {
  return <Glyph {...props} d="M6 4h8M6 8h8M6 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />;
}

export function SettingsIcon(props: IconProps) {
  return <Glyph {...props} d="M2 4.5h4m2 0h6M2 11.5h6m2 0h4M7 2.75v3.5M11 9.75v3.5" />;
}

/** The drawer toggle's glyph: two rules, as the design draws it. */
export function MenuIcon(props: IconProps) {
  return <Glyph {...props} strokeWidth={1.6} d="M2.5 5.5h11m-11 5h11" />;
}

export function CloseIcon(props: IconProps) {
  return <Glyph {...props} d="M4 4l8 8M12 4l-8 8" />;
}

/** Points down when the group it heads is open, and right when it is closed. */
export function DisclosureIcon({ open, ...props }: IconProps & { open: boolean }) {
  return <Glyph {...props} strokeWidth={1.6} d={open ? 'M4.5 6.5 8 10l3.5-3.5' : 'M6.5 4.5 10 8l-3.5 3.5'} />;
}

export function SortIcon({ direction, ...props }: IconProps & { direction: 'asc' | 'desc' }) {
  return <Glyph {...props} strokeWidth={1.8} d={direction === 'asc' ? 'M4.5 9.5 8 6l3.5 3.5' : 'M4.5 6.5 8 10l3.5-3.5'} />;
}

export function SearchIcon(props: IconProps) {
  return <Glyph {...props} d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm7 2-3.5-3.5" />;
}

/** Leaves the dashboard: a link that opens the public site. */
export function ExternalIcon(props: IconProps) {
  return <Glyph {...props} d="M9.5 2.5h4v4m0-4L7.5 8.5m4 1.5v3.5h-9v-9H6" />;
}

export function PlusIcon(props: IconProps) {
  return <Glyph {...props} strokeWidth={1.8} d="M8 3v10M3 8h10" />;
}

export function ChevronRightIcon(props: IconProps) {
  return <Glyph {...props} strokeWidth={1.7} d="M6 3.5 10.5 8 6 12.5" />;
}

export function DownloadIcon(props: IconProps) {
  return <Glyph {...props} d="M8 2.5v8m-3.5-3.5L8 10.5 11.5 7M3 13.5h10" />;
}

export function SignOutIcon(props: IconProps) {
  return <Glyph {...props} d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10.5 11 13.5 8l-3-3M13.5 8H6" />;
}

/** The sidebar's own toggle: a panel with its rail, and which way it will move. */
export function SidebarIcon({ collapsed, ...props }: IconProps & { collapsed: boolean }) {
  return (
    <Glyph
      {...props}
      d={`M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm3 0v11${collapsed ? 'M9 6.5 10.5 8 9 9.5' : 'M11 6.5 9.5 8 11 9.5'}`}
    />
  );
}

/** The AI screen: a spark of four points. */
export function SparkIcon(props: IconProps) {
  return <Glyph {...props} d="M8 1.5c.4 2.9 1.6 4.1 4.5 4.5-2.9.4-4.1 1.6-4.5 4.5-.4-2.9-1.6-4.1-4.5-4.5 2.9-.4 4.1-1.6 4.5-4.5zm4.5 8.5c.2 1.3.7 1.8 2 2-1.3.2-1.8.7-2 2-.2-1.3-.7-1.8-2-2 1.3-.2 1.8-.7 2-2z" />;
}

export function EyeIcon({ open, ...props }: IconProps & { open: boolean }) {
  return (
    <Glyph
      {...props}
      d={
        open
          ? 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
          : 'M2 2l12 12M6.6 6.6a2 2 0 0 0 2.8 2.8M4.3 4.4C2.6 5.5 1.5 8 1.5 8S4 12.5 8 12.5c1.3 0 2.5-.4 3.5-1M7 3.6c.3 0 .7-.1 1-.1 4 0 6.5 4.5 6.5 4.5s-.6 1.1-1.7 2.3'
      }
    />
  );
}
