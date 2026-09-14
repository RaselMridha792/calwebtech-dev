/** The first focusable element on the page. Visible only while it has focus. */
export function SkipLink({ href = '#main', children = 'Skip to content' }: { href?: string; children?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-999 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
    >
      {children}
    </a>
  );
}
