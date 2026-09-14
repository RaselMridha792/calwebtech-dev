import type { CompanyAboutView } from '@calwebtech/shared';
import { Section } from '@/components/site/section';
import { reveal } from '@/components/ui/primitives';
import { ResponsiveImage } from '@/components/ui/responsive-image';

/** The about page's story: a question-shaped H2, the narrative, and a photograph beside it. */
export function Story({ story }: { story: CompanyAboutView['content']['story'] }) {
  return (
    <Section id="story" tone="white" labelledBy="story-heading">
      <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className={story.image ? 'lg:col-span-7' : 'lg:col-span-9'} {...reveal()}>
          <h2 id="story-heading" className="max-w-[24ch] font-display text-[34px] leading-[1.1] font-extrabold text-ink lg:text-[42px]">
            {story.heading}
          </h2>
          {story.intro ? <p className="mt-5 text-[18px] leading-relaxed text-ink">{story.intro}</p> : null}
          <div className="mt-6 max-w-[68ch] space-y-5 text-[17px] leading-relaxed">
            {story.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
        {story.image ? (
          <div className="relative aspect-[4/3] max-w-full overflow-hidden rounded-2xl bg-mist lg:col-span-5 lg:mt-3" {...reveal(1)}>
            <ResponsiveImage
              src={story.image.src}
              alt={story.image.alt}
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>
    </Section>
  );
}
