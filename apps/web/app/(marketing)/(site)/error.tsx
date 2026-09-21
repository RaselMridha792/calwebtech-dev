'use client';

// Kept to plain markup: this boundary ships to every route in the site group (docs/10-site-pages.md).
const HOME = '/';
const CONTACT = '/contact/';

/** A site page failed to render: the branded error inside the site layout, with a retry. */
export default function SiteError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="shell pt-16 pb-24 lg:pt-24 lg:pb-32">
      <title>Something went wrong | Calwebtech</title>
      <p className="text-[14px] font-semibold text-gold-ink">Something went wrong</p>
      <h1 className="mt-5 max-w-[22ch] font-display text-[38px] leading-[1.05] font-extrabold text-ink sm:text-[50px]">
        This page did not load properly
      </h1>
      <p className="mt-6 max-w-[58ch] text-[18px] leading-relaxed">
        The fault is on our side, not yours. Try again in a moment. If it keeps happening, call or email us with the
        details at the foot of this page and a person will help.
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={retry}
          className="inline-flex h-14 items-center bg-navy-900 px-7 text-[16px] font-semibold text-ink-invert hover:bg-navy-700"
        >
          Try again
        </button>
        <a
          href={HOME}
          className="inline-flex h-14 items-center border border-hairline bg-canvas-raised px-7 text-[16px] font-semibold text-ink hover:border-ink"
        >
          Go to the homepage
        </a>
        <a href={CONTACT} className="inline-flex h-14 items-center px-3 text-[16px] font-semibold text-gold-ink hover:text-gold-600">
          Contact us
        </a>
      </div>
    </section>
  );
}
