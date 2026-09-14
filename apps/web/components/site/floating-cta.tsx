import type { Link } from '@calwebtech/shared';

/** "Start a project", pinned from tablet widths up, as approved. Hidden by `PageHasOwnForm`. */
export function FloatingCta({ link }: { link: Link }) {
  return (
    <a
      href={link.href}
      data-floating-cta=""
      className="fixed right-6 bottom-6 z-90 hidden items-center rounded-full bg-ink px-6 py-3.5 font-semibold text-white shadow-[0_16px_36px_-12px_rgba(10,29,55,.6)] hover:bg-ink2 md:inline-flex"
    >
      {link.label}
    </a>
  );
}
