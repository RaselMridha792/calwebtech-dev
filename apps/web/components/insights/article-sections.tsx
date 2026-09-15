import {
  articleToc,
  insightsArticlePath,
  servicePath,
  type ArticleHeading,
  type Image,
  type InsightsArticleCopy,
  type InsightsArticleView,
  type InsightsAuthor,
} from '@calwebtech/shared';
import { CardGrid, CaseStudyCard, LinkCard } from '../site/cards';
import { CheckList } from '../site/lists';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { ResponsiveImage } from '../ui/responsive-image';
import { formatArticleDate, wasUpdated } from './dates';

/**
 * The parts of the article template around the body (docs/03-page-specs.md, Insights):
 * the author and dates line, the key takeaways, the table of contents, the contextual
 * service call to action, the author block, and the related services and articles.
 */

/** The article's cover photograph, beside the H1 and the answer block. */
export function ArticleCover({ image }: { image: Image }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-mist">
      <ResponsiveImage
        src={image.src}
        alt={image.alt}
        fill
        sizes="(min-width: 1024px) 40vw, 100vw"
        className="object-cover"
        priority
      />
    </div>
  );
}

/** Who wrote it, when it was published and updated, and how long it takes to read. */
export function ArticleMeta({ view }: { view: InsightsArticleView }) {
  const { copy, author } = view;
  const updated = wasUpdated(view.publishedAt, view.updatedAt);
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4 text-[14.5px]">
      {author ? (
        <span className="flex items-center gap-3">
          {author.photo ? (
            <ResponsiveImage
              src={author.photo.src}
              alt=""
              width={44}
              height={44}
              sizes="44px"
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : null}
          <span>
            {`${copy.byLabel} `}
            <b className="text-ink">{author.name}</b>
            {`, ${author.role}`}
          </span>
        </span>
      ) : null}
      <span>
        {`${copy.publishedLabel} `}
        <time dateTime={view.publishedAt} className="text-ink">
          {formatArticleDate(view.publishedAt)}
        </time>
      </span>
      {updated ? (
        <span>
          {`${copy.updatedLabel} `}
          <time dateTime={view.updatedAt} className="text-ink">
            {formatArticleDate(view.updatedAt)}
          </time>
        </span>
      ) : null}
      <span>{`${String(view.readingTime)} ${copy.readingTimeLabel}`}</span>
    </div>
  );
}

/** The key takeaways, the short answer to "what does this article say?". */
export function ArticleTakeaways({ takeaways, label }: { takeaways: readonly string[]; label: string }) {
  if (takeaways.length === 0) return null;
  return (
    <aside aria-labelledby="article-takeaways-label" className="rounded-2xl border border-line bg-mist2 p-7">
      <p id="article-takeaways-label" className="font-display text-[17px] font-extrabold text-ink">
        {label}
      </p>
      <div className="mt-5">
        <CheckList items={[...takeaways]} />
      </div>
    </aside>
  );
}

/** The table of contents, shown for an article long enough to need one. */
export function ArticleToc({ items, label }: { items: readonly ArticleHeading[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-labelledby="article-toc-label" className="rounded-2xl border border-line bg-mist2 p-6 lg:sticky lg:top-28">
      <p id="article-toc-label" className="font-display text-[15px] font-extrabold text-ink">
        {label}
      </p>
      <ol className="mt-4 space-y-1 text-[14.5px]">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
            <a href={`#${item.id}`} className="inline-block py-1 underline-offset-4 hover:text-ink hover:underline">
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The inline subscribe block's frame; the form inside it is the page's only client code. */
export function SubscribeBlock({ copy, children }: { copy: InsightsArticleCopy['newsletter']; children: React.ReactNode }) {
  return (
    <aside
      aria-labelledby="article-subscribe-label"
      className="mt-14 rounded-2xl border border-line bg-linear-to-br from-mist2 via-white to-mist p-7 lg:p-9"
    >
      <p id="article-subscribe-label" className="font-display text-[21px] leading-snug font-extrabold text-ink">
        {copy.heading}
      </p>
      <p className="mt-3 max-w-[58ch] text-[15.5px] leading-relaxed">{copy.body}</p>
      {children}
    </aside>
  );
}

/** The service this article is really about, offered where the reader has just finished it. */
export function ServiceCallToAction({ view }: { view: InsightsArticleView }) {
  const service = view.services[0];
  if (!service) return null;
  const { serviceCta } = view.copy;
  return (
    <aside aria-labelledby="article-service-label" className="mt-14 rounded-2xl border border-line bg-white p-7 shadow-panel lg:p-9">
      <p className="text-[13.5px] font-semibold text-primary">{serviceCta.eyebrow}</p>
      <p id="article-service-label" className="mt-2 font-display text-[21px] leading-snug font-extrabold text-ink">
        {service.title}
      </p>
      <p className="mt-3 max-w-[58ch] text-[15.5px] leading-relaxed">{service.summary}</p>
      <p className="mt-3 max-w-[58ch] text-[15.5px] leading-relaxed">{serviceCta.body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={servicePath(service.slug)}
          className="inline-flex h-12 items-center rounded-xl bg-primary px-6 text-[15.5px] font-semibold text-white hover:bg-primaryd"
        >
          {serviceCta.linkLabel}
          <span className="sr-only">{`: ${service.title}`}</span>
        </a>
        <a
          href={serviceCta.contactCta.href}
          className="inline-flex h-12 items-center rounded-xl border border-line px-6 text-[15.5px] font-semibold text-ink hover:border-ink hover:bg-mist2"
        >
          {serviceCta.contactCta.label}
        </a>
      </div>
    </aside>
  );
}

/** Who wrote the article and why they are worth reading on it. */
export function AuthorBlock({ author, label }: { author: InsightsAuthor | null; label: string }) {
  if (!author) return null;
  return (
    <aside aria-labelledby="article-author-label" className="mt-14 rounded-2xl border border-line bg-mist2 p-7">
      <p id="article-author-label" className="font-display text-[15px] font-extrabold text-ink">
        {label}
      </p>
      <div className="mt-5 flex flex-wrap items-start gap-5">
        {author.photo ? (
          <ResponsiveImage
            src={author.photo.src}
            alt={author.photo.alt}
            width={80}
            height={80}
            sizes="80px"
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : null}
        <div className="flex-1">
          <p className="font-display text-[18px] font-bold text-ink">{author.name}</p>
          <p className="text-[14.5px]">{author.role}</p>
          {author.bio ? <p className="mt-3 max-w-[60ch] text-[15.5px] leading-relaxed">{author.bio}</p> : null}
          {author.credentials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2 text-[13.5px]">
              {author.credentials.map((credential) => (
                <li key={credential} className="rounded-md border border-line bg-white px-2.5 py-1 text-ink">
                  {credential}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/** The services the article links to, and the case study behind it. */
export function ArticleServicesSection({ view }: { view: InsightsArticleView }) {
  const { services, caseStudy, copy } = view;
  if (services.length === 0 && !caseStudy) return null;
  return (
    <Section tone="tint" labelledBy="article-services-heading">
      <SectionHeading id="article-services-heading" title={copy.servicesHeading} />
      <CardGrid columns={3}>
        {caseStudy ? <CaseStudyCard study={caseStudy} linkLabel={copy.caseStudyLinkLabel} /> : null}
        {services.map((service, index) => (
          <LinkCard
            key={service.slug}
            href={servicePath(service.slug)}
            title={service.title}
            body={service.summary}
            linkLabel={copy.serviceCta.linkLabel}
            step={index + 1}
          />
        ))}
      </CardGrid>
    </Section>
  );
}

/** What to read next: the same topic first. */
export function RelatedArticlesSection({ view }: { view: InsightsArticleView }) {
  const { relatedArticles, copy } = view;
  if (relatedArticles.length === 0) return null;
  return (
    <Section labelledBy="article-related-heading">
      <SectionHeading id="article-related-heading" title={copy.relatedHeading} link={copy.relatedLink} />
      <CardGrid columns={3}>
        {relatedArticles.map((article, index) => (
          <LinkCard
            key={article.slug}
            href={insightsArticlePath(article.slug)}
            title={article.title}
            body={article.excerpt}
            eyebrow={[article.category?.name, `${String(article.readingTime)} ${copy.readingTimeLabel}`]
              .filter((part): part is string => Boolean(part))
              .join(' · ')}
            image={article.image}
            step={index}
          />
        ))}
      </CardGrid>
    </Section>
  );
}

/** The article's headings, or none when it is short enough to read straight through. */
export const tocOf = (view: InsightsArticleView): ArticleHeading[] => articleToc(view);
