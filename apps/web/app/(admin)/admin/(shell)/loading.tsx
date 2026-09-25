/**
 * What a screen shows while its data is on the way: the shape of a header and of cards, so
 * moving between screens answers at once instead of leaving the old one up with no sign that
 * anything is happening. The pulse is opacity only and stops under reduced motion.
 */
export default function AdminLoading() {
  return (
    <div
      id="admin-main"
      role="status"
      aria-live="polite"
      className="min-h-0 flex-1 overflow-hidden"
    >
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 motion-safe:animate-pulse">
        <div className="flex flex-col gap-3">
          <span className="h-3 w-20 rounded-full bg-admin-mist" />
          <span className="h-8 w-64 max-w-full rounded-lg bg-admin-mist" />
          <span className="h-4 w-[28rem] max-w-full rounded-full bg-admin-hover" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="h-[124px] rounded-xl border border-admin-line2 bg-admin-surface" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <span className="h-[300px] rounded-xl border border-admin-line2 bg-admin-surface xl:col-span-8" />
          <span className="h-[300px] rounded-xl border border-admin-line2 bg-admin-surface xl:col-span-4" />
        </div>
      </div>
    </div>
  );
}
