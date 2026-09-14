'use client';

import './globals.css';

const HOME = '/';

/**
 * The root layout itself failed, so nothing else renders: a branded page with its own document.
 * Kept to plain markup, since it ships with every route.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="bg-white font-sans text-body">
        <title>Something went wrong | Calwebtech</title>
        <main id="main" className="shell py-24 lg:py-32">
          <p className="font-display text-[20px] font-extrabold text-ink">Calwebtech</p>
          <h1 className="mt-10 max-w-[22ch] font-display text-[38px] leading-[1.05] font-extrabold text-ink sm:text-[50px]">
            Our website is having a problem
          </h1>
          <p className="mt-6 max-w-[58ch] text-[18px] leading-relaxed">
            The fault is on our side, not yours. Please try again in a few minutes.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-14 items-center rounded-xl bg-primary px-7 text-[16px] font-semibold text-white hover:bg-primaryd"
            >
              Try again
            </button>
            <a
              href={HOME}
              className="inline-flex h-14 items-center rounded-xl border border-line px-7 text-[16px] font-semibold text-ink hover:border-ink"
            >
              Go to the homepage
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
