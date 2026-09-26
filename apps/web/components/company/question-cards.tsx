import { reveal } from '@/components/ui/primitives';

/**
 * Questions buyers ask, each answered on its own card: values on the about page, who does
 * what on the team page, how a stack is chosen. Titles are H3s under the section's H2.
 *
 * Numbered on rules rather than boxed; a rule draws champagne under the pointer.
 */
export function QuestionCards({ items }: { items: readonly { title: string; body: string }[] }) {
  if (items.length === 0) return null;
  const columns = items.length % 3 === 0 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2';
  return (
    <ul className={`grid gap-x-10 gap-y-6 ${columns}`}>
      {items.map((item, index) => (
        <li key={item.title} className="group relative border-t border-hairline pt-6 pb-4 before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:origin-left before:scale-x-0 before:bg-gold-ink before:transition-transform before:duration-500 before:ease-out-quint hover:before:scale-x-100 pb-6" {...reveal(index)}>
          <span className="meta text-ink-muted transition-colors duration-150 group-hover:text-gold-ink">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="heading-md mt-4 text-ink">{item.title}</h3>
          <p className="body-base mt-3 text-ink-muted">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}
