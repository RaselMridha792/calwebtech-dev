/**
 * Set in type, because there is no logo file yet (session.md, "Known gaps"). The mark is a
 * plain square rather than a glyph so that replacing it later changes one element.
 */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="size-[22px] rounded-[3px] bg-primary" />
      <span className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-white">
        calwebtech
        <span className="font-semibold text-admin-dim"> admin</span>
      </span>
    </span>
  );
}
