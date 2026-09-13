import { PlusIcon } from '../ui/icons';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * One answer open at a time, the first open by default, as approved. Built on
 * native exclusive `<details name>`, so it needs no JavaScript and works before
 * hydration.
 */
export function FaqAccordion({ items, group }: { items: FaqItem[]; group: string }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, index) => (
        <details key={item.id} name={group} open={index === 0} className="group py-6">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 [&::-webkit-details-marker]:hidden">
            <h3 className="font-display text-[18px] font-bold text-ink lg:text-[20px]">
              {item.question}
            </h3>
            <span
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mist text-ink transition-transform duration-200 group-open:rotate-45"
              aria-hidden="true"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </span>
          </summary>
          <p className="pt-4 pr-12 leading-relaxed">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
