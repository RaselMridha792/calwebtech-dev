import type { SVGProps } from 'react';

/**
 * The admin's navigation glyphs, drawn here rather than pulled from an icon package: the
 * marketing side already hand-writes its own (components/ui/icons.tsx), and a dependency
 * for twelve shapes would be the largest thing in the bundle.
 *
 * All are 16-viewBox stroke glyphs at the weight the design handoff specifies, and all are
 * decorative — every nav item carries its own text label.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.35,
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
