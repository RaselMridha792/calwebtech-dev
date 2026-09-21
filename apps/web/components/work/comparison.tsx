import type { Image } from '@calwebtech/shared';
import { BeforeAfterSlider } from '../landing/before-after-slider';
import { ResponsiveImage } from '../ui/responsive-image';

export interface ComparisonFigure {
  label: string;
  before: string;
  after: string;
}

function frame(image: Image) {
  return (
    <ResponsiveImage
      src={image.src}
      alt={image.alt}
      fill
      sizes="(min-width: 1024px) 60vw, 100vw"
      className="object-cover object-top"
      draggable={false}
    />
  );
}

/**
 * The approved before and after slider (drag, touch or the range input by keyboard) with
 * the server-rendered screenshots inside it. Only the slider ships client code.
 */
export function ComparisonSlider({ before, after, clientName }: { before: Image; after: Image; clientName: string }) {
  return <BeforeAfterSlider before={frame(before)} after={frame(after)} clientName={clientName} />;
}

/**
 * What moved between the two versions, as a table: the measure, its value before and its
 * value after. The after figure is an outcome, so it is set in the result colour.
 */
export function ComparisonTable({
  figures,
  caption,
  beforeLabel,
  afterLabel,
}: {
  figures: readonly ComparisonFigure[];
  caption: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  if (figures.length === 0) return null;
  return (
    <table className="w-full border-collapse text-left text-[15px]">
      <caption className="pb-3 text-left text-[14px] font-semibold text-ink-invert-muted">{caption}</caption>
      <thead>
        <tr className="border-b border-ink-invert/15 text-[13px] text-ink-invert-muted">
          <th scope="col" className="py-2 pr-3 font-medium">
            <span className="sr-only">Measure</span>
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            {beforeLabel}
          </th>
          <th scope="col" className="py-2 font-medium">
            {afterLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {figures.map((figure) => (
          <tr key={figure.label} className="border-b border-ink-invert/15">
            <th scope="row" className="py-3 pr-3 text-[14.5px] font-normal text-ink-invert-muted">
              {figure.label}
            </th>
            <td className="py-3 pr-3 font-display font-bold text-ink-invert-muted">{figure.before}</td>
            <td className="py-3">
              <span className="font-display text-[18px] font-extrabold text-gold-ink">{figure.after}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
