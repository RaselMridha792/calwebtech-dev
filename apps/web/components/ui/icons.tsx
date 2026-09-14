import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = { fill: 'none', 'aria-hidden': true, focusable: false } as const;

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" {...base} {...props}>
      <path
        d="M2.5 7.5 5.5 10.5 11.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TickIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base} {...props}>
      <path
        d="M3 8.5 6.5 12 13 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base} {...props}>
      <path
        d="M8 1.5 14 4v4.5c0 3.3-2.4 5.5-6 6.5-3.6-1-6-3.2-6-6.5V4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16 16" {...base} {...props}>
      <path d="M2 4.5h12v9H2z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h12M5.5 2v4M10.5 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" {...base} {...props}>
      <path
        d="M5 3h3l1.5 4-2 1.5a10 10 0 0 0 4 4L13 10.5 17 12v3a1.5 1.5 0 0 1-1.7 1.5A14 14 0 0 1 3.5 4.7 1.5 1.5 0 0 1 5 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 12 8" {...base} {...props}>
      <path d="M1 1.5 6 6.5l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" {...base} {...props}>
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function DragIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" {...base} {...props}>
      <path
        d="M7 5 3 10l4 5M13 5l4 5-4 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 12 12" {...base} {...props}>
      <path d="M3.5 2v8M8.5 2v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 12 12" {...base} {...props}>
      <path d="M3 1.8v8.4L10 6z" fill="currentColor" />
    </svg>
  );
}
