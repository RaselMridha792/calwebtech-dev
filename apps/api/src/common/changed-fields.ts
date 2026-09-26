/**
 * What an audit entry records of a JSON value's change, shared by the page copy screen
 * (decision 59) and `settings-cli` (decision 68), so both say it the same way.
 */

/**
 * The top-level fields whose value changed, so the log says what an edit touched. Compared
 * with their keys sorted, because Postgres keeps a stored object's keys in an order of its own.
 */
export function changedSections(before: unknown, after: object): string[] {
  const previous = typeof before === 'object' && before !== null ? (before as Record<string, unknown>) : {};
  const next = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return [...keys].filter((key) => canonical(previous[key]) !== canonical(next[key])).sort();
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}

/** A field whose name says it holds something secret. */
const SECRET_FIELD = /secret|token|password|passphrase|api[-_]?key|private[-_]?key|credential|signing/i;

/**
 * A copy of a value with every secret-named field's value replaced, at any depth, so a
 * setting that ever holds a secret can be audited without the secret landing in the log.
 * The field's name stays, so the log still says that it changed.
 */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
      key,
      SECRET_FIELD.test(key) && inner !== null && inner !== undefined && inner !== '' ? '[redacted]' : redactSecrets(inner),
    ]),
  );
}
