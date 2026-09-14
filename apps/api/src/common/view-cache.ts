/**
 * Short-lived cache for public page views. The web app renders site pages per request, so
 * this bounds database load, and a changed record or setting is live within the TTL without
 * a redeploy (docs/08-decisions.md, 30 and 34).
 *
 * Concurrent requests for the same key share one build. A failed build is not cached, so
 * the next request retries. A view that resolves to null (no such published record) is
 * cached like any other, which absorbs repeated requests for a missing slug.
 */
export class ViewCache<T> {
  private readonly entries = new Map<string, { view: Promise<T>; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    /** Upper bound on cached keys, so requests for many different slugs cannot grow it. */
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string, build: () => Promise<T>): Promise<T> {
    const now = this.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > now) return hit.view;

    const view = build();
    // Re-inserted, so the map stays in order of last build and the oldest is evicted first.
    this.entries.delete(key);
    this.entries.set(key, { view, expiresAt: now + this.ttlMs });
    this.prune(now);
    view.catch(() => {
      if (this.entries.get(key)?.view === view) this.entries.delete(key);
    });
    return view;
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(key);
    }
  }
}
