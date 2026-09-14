import { INSIGHTS_SUBSCRIBE_SHARE, articleToc, type InsightsArticleView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { Section } from '../site/section';
import { ArticleTakeaways, ArticleToc, AuthorBlock, ServiceCallToAction, SubscribeBlock } from './article-sections';
import { Blocks, articleBodyContext, articleTokens, splitAtShare } from './markdown';

/**
 * The article itself: the key takeaways, the table of contents, the body rendered from
 * Markdown on the server, the subscribe block about sixty per cent of the way down, the
 * contextual service call to action and the author block.
 *
 * Not deferred: the body is the page, and `content-visibility` on a long article moves the
 * anchors the table of contents points at (docs/09-performance.md).
 *
 * The subscribe form arrives as a node, the way `ContactFormSection` takes its lead form:
 * the form is the page's only client component and reaches a server action, so keeping it
 * out of this module leaves the whole composition renderable in a unit test.
 */
export function ArticleBodySection({ view, subscribeForm }: { view: InsightsArticleView; subscribeForm: ReactNode }) {
  const tokens = articleTokens(view.body);
  const context = articleBodyContext(tokens);
  const [opening, rest] = splitAtShare(tokens, INSIGHTS_SUBSCRIBE_SHARE);
  const toc = articleToc(view);
  const { copy } = view;

  return (
    <Section deferred={false}>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        {view.takeaways.length > 0 ? (
          <div className="lg:col-span-8 lg:row-start-1">
            <ArticleTakeaways takeaways={view.takeaways} label={copy.takeawaysLabel} />
          </div>
        ) : null}
        {toc.length > 0 ? (
          <div className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
            <ArticleToc items={toc} label={copy.tocLabel} />
          </div>
        ) : null}

        <div className="max-w-[72ch] lg:col-span-8 lg:col-start-1 lg:row-start-2">
          <Blocks tokens={opening} ctx={context} />
          <SubscribeBlock copy={copy.newsletter}>{subscribeForm}</SubscribeBlock>
          <Blocks tokens={rest} ctx={context} />
          <ServiceCallToAction view={view} />
          <AuthorBlock author={view.author} label={copy.authorLabel} />
        </div>
      </div>
    </Section>
  );
}
