import { reveal } from '@/components/ui/primitives';

/**
 * Questions buyers ask, each answered on its own card: values on the about page, who does
 * what on the team page, how a stack is chosen. Titles are H3s under the section's H2.
 */
export function QuestionCards({ items }: { items: readonly { title: string; body: string }[] }) {
  if (items.length === 0) return null;
  const columns = items.length % 3 === 0 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2';
  return (
    <ul className={`grid gap-5 lg:gap-6 ${columns}`}>
      {items.map((item, index) => (
        <li key={item.title} className="rounded-2xl border border-line bg-white p-7" {...reveal(index)}>
          <h3 className="font-display text-[19px] leading-snug font-bold text-ink">{item.title}</h3>
          <p className="mt-3 text-[15.5px] leading-relaxed">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}
