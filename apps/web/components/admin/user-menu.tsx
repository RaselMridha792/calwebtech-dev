'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { adminMutate } from '@/lib/admin/mutate';
import { SignOutIcon } from './icons';
import { button } from './ui/styles';

/**
 * Who is signed in, at the foot of the sidebar, and the way out.
 *
 * A disclosure rather than an ARIA menu: it holds one line of facts and one button, and a
 * button that says what it opens is all a screen reader needs. It keeps the keyboard
 * contract RULES.md sets for a control that opens a panel: Escape closes it and focus goes
 * back to the control, which opens it again, and `aria-expanded` follows what is on screen.
 */
export function UserMenu({
  name,
  email,
  role,
  rail,
}: {
  name: string;
  email: string;
  role: string;
  /** The sidebar is narrowed to icons: show the initials only. */
  rail: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const control = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      control.current?.focus();
    };
    const onPointer = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={control}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={`flex min-h-12 w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors duration-150 hover:bg-admin-hover ${
          rail ? 'lg:justify-center' : ''
        }`}
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-admin-mist font-display text-[13px] font-bold text-ink-invert"
        >
          {initials(name)}
        </span>
        <span className={`flex min-w-0 flex-col leading-tight ${rail ? 'lg:sr-only' : ''}`}>
          <span className="truncate text-[13.5px] font-semibold text-ink-invert">{name}</span>
          <span className="text-[12px] text-admin-muted capitalize">{role}</span>
        </span>
        <span className="sr-only">, account and sign out</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-admin-line bg-admin-hover p-2 shadow-plate"
      >
        <div className="px-2.5 pt-1.5 pb-3">
          <p className="truncate text-[14px] font-semibold text-ink-invert">{name}</p>
          <p className="truncate text-[12.5px] text-ink-invert-muted">{email}</p>
          <p className="mt-1 text-[12px] text-admin-muted">
            Signed in as <span className="capitalize">{role}</span>
          </p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void adminMutate('/auth/logout', { method: 'POST' })
          .catch(() => undefined)
          // Whatever the API answered, the way out is the sign-in screen. `refresh` clears
          // what was rendered for the old session out of the client cache.
          .finally(() => {
            router.replace('/admin/login/');
            router.refresh();
          });
      }}
      className={`${button('ghost', 'md')} w-full justify-start`}
    >
      <SignOutIcon className="size-4" />
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
