import { staticTextParts } from '@calwebtech/shared';
import { reveal } from '../ui/primitives';
import type { Ground } from '../site/section';

/** Copy with `[label](href)` links, rendered as text and anchors. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {staticTextParts(text).map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          <a key={`${part.href}-${String(index)}`} href={part.href}>
            {part.label}
          </a>
        ),
      )}
    </>
  );
}

/**
 * Titled points in a numbered or plain card grid, on light or dark ground. The titles are
 * H3s under the section's H2.
 */
export function PointGrid({
  items,
  ground = 'light',
  numbered = false,
  columns = 3,
}: {
  items: readonly { title: string; body: string }[];
  ground?: Ground;
  numbered?: boolean;
  columns?: 2 | 3 | 4;
}) {
  const dark = ground === 'dark';
  const List = numbered ? 'ol' : 'ul';
  const layout = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-2 lg:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <List className={`grid gap-5 lg:gap-6 ${layout}`}>
      {items.map((item, index) => (
        <li
          key={item.title}
          className={`flex flex-col  p-7 ${dark ? 'glass' : 'border border-hairline bg-canvas-raised'}`}
          {...reveal(index)}
        >
          {numbered ? (
            <span
              className={`grid h-9 w-9 place-items-center  font-display text-[15px] font-extrabold ${dark ? 'bg-canvas-raised text-ink' : 'bg-navy-900 text-ink-invert'}`}
              aria-hidden="true"
            >
              {String(index + 1)}
            </span>
          ) : null}
          <h3 className={`${numbered ? 'mt-5 ' : ''}font-display text-[19px] leading-snug font-bold ${dark ? '' : 'text-ink'}`}>
            {item.title}
          </h3>
          <p className={`mt-2.5 text-[15.5px] leading-relaxed ${dark ? 'text-ink-invert-muted' : ''}`}>{item.body}</p>
        </li>
      ))}
    </List>
  );
}

/** The telephone and email of the business, as links. */
export function ContactLinks({
  contact,
  phoneLabel,
  emailLabel,
}: {
  contact: { phone: string; phoneE164: string; email: string };
  phoneLabel: string;
  emailLabel: string;
}) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2">
      <div>
        <dt className="text-[13.5px] font-medium">{phoneLabel}</dt>
        <dd className="mt-1">
          <a href={`tel:${contact.phoneE164}`} className="inline-block py-1 font-display text-[19px] font-bold text-ink hover:text-gold-ink">
            {contact.phone}
          </a>
        </dd>
      </div>
      <div>
        <dt className="text-[13.5px] font-medium">{emailLabel}</dt>
        <dd className="mt-1">
          <a
            href={`mailto:${contact.email}`}
            className="inline-block py-1 font-display text-[19px] font-bold break-all text-ink hover:text-gold-ink"
          >
            {contact.email}
          </a>
        </dd>
      </div>
    </dl>
  );
}
