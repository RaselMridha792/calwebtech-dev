import { articleWordCount, headingId, plainInline } from '@calwebtech/shared';
import { Lexer, type Token, type Tokens } from 'marked';
import type { ReactNode } from 'react';
import { ResponsiveImage } from '../ui/responsive-image';

/**
 * The article body, authored as Markdown on the `Post` record and rendered here on the
 * server: no client JavaScript, and no HTML from the record reaches the page. Tokens come
 * from marked's lexer and are turned into elements, so nothing is ever set as raw HTML.
 * Anything the renderer does not know how to draw (inline or block HTML) is dropped.
 */

/** Blocks of a body, in document order. */
export const articleTokens = (markdown: string): Token[] => Lexer.lex(markdown, { gfm: true });

export interface ArticleBodyContext {
  /** The anchor of each top-level heading, matching `articleOutline` in the contract. */
  headingIds: ReadonlyMap<Tokens.Heading, string>;
  /** The heading a table sits under, so its scrollable region has an accessible name. */
  tableLabels: ReadonlyMap<Tokens.Table, string>;
}

const isHeading = (token: Token): token is Tokens.Heading => token.type === 'heading';
const isTable = (token: Token): token is Tokens.Table => token.type === 'table';

/**
 * Anchors for the article's headings, in one pass over the whole body, so the two halves
 * either side of the subscribe block number repeated headings as one document does.
 */
export function articleBodyContext(tokens: readonly Token[]): ArticleBodyContext {
  const used = new Map<string, number>();
  const headingIds = new Map<Tokens.Heading, string>();
  const tableLabels = new Map<Tokens.Table, string>();
  let lastHeading: string | undefined;

  for (const token of tokens) {
    if (isHeading(token) && token.depth >= 2 && token.depth <= 3) {
      const title = plainInline(token.text);
      const id = headingId(title, used);
      headingIds.set(token, id);
      lastHeading = id;
    }
    if (isTable(token) && lastHeading) tableLabels.set(token, lastHeading);
  }
  return { headingIds, tableLabels };
}

/**
 * Where the inline subscribe block goes: before the top-level heading nearest `share` of
 * the way through the article, or, without a heading there, the block boundary nearest it.
 * Returns the two halves of the body.
 */
export function splitAtShare(tokens: readonly Token[], share: number): [Token[], Token[]] {
  const words = tokens.map((token) => articleWordCount(token.raw));
  const total = words.reduce((sum, count) => sum + count, 0);
  if (total === 0) return [[...tokens], []];

  let running = 0;
  const boundaries = tokens.map((token, index) => {
    const before = running;
    running += words[index] ?? 0;
    return { index, share: before / total, heading: isHeading(token) && token.depth === 2 };
  });
  const usable = boundaries.filter((boundary) => boundary.index > 0 && boundary.share < 0.95);
  const headings = usable.filter((boundary) => boundary.heading);
  const candidates = headings.length > 0 ? headings : usable;
  if (candidates.length === 0) return [[...tokens], []];

  const best = candidates.reduce((closest, boundary) =>
    Math.abs(boundary.share - share) < Math.abs(closest.share - share) ? boundary : closest,
  );
  return [tokens.slice(0, best.index), tokens.slice(best.index)];
}

/* ------------------------------------------------------------------ rendering */

/** Links keep the page safe: site paths, anchors, and http, https and mailto URLs only. */
export function safeHref(href: string): string | null {
  const value = href.trim();
  if (value.startsWith('#')) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  const url = URL.parse(value);
  return url && ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : null;
}

function Inline({ tokens }: { tokens: readonly Token[] | undefined }): ReactNode {
  if (!tokens) return null;
  return (
    <>
      {tokens.map((token, index) => {
        const key = String(index);
        switch (token.type) {
          case 'text':
          case 'escape': {
            const nested = (token as Tokens.Text).tokens;
            return nested ? <Inline key={key} tokens={nested} /> : token.text;
          }
          case 'strong':
            return (
              <strong key={key} className="font-semibold text-ink">
                <Inline tokens={(token as Tokens.Strong).tokens} />
              </strong>
            );
          case 'em':
            return (
              <em key={key}>
                <Inline tokens={(token as Tokens.Em).tokens} />
              </em>
            );
          case 'del':
            return (
              <del key={key}>
                <Inline tokens={(token as Tokens.Del).tokens} />
              </del>
            );
          case 'codespan':
            return (
              <code key={key} className="rounded bg-mist px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
                {(token as Tokens.Codespan).text}
              </code>
            );
          case 'br':
            return <br key={key} />;
          case 'link': {
            const link = token as Tokens.Link;
            const href = safeHref(link.href);
            if (!href) return <Inline key={key} tokens={link.tokens} />;
            return (
              <a
                key={key}
                href={href}
                className="font-medium text-primary underline underline-offset-4 hover:text-primaryd"
              >
                <Inline tokens={link.tokens} />
              </a>
            );
          }
          case 'image': {
            const image = token as Tokens.Image;
            const src = safeHref(image.href);
            // The media library requires alt text, so an image without it is not rendered.
            if (!src || image.text.trim() === '') return null;
            return (
              <span key={key} className="relative mt-6 block aspect-video overflow-hidden rounded-xl bg-mist">
                <ResponsiveImage src={src} alt={image.text} fill sizes="(min-width: 1024px) 45rem, 100vw" className="object-cover" />
              </span>
            );
          }
          default:
            // Inline HTML is dropped: an article body is Markdown, never markup.
            return null;
        }
      })}
    </>
  );
}

const CELL_ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function cellClass(align: 'center' | 'left' | 'right' | null): string {
  return align ? CELL_ALIGN[align] : 'text-left';
}

function Block({ token, ctx }: { token: Token; ctx: ArticleBodyContext }): ReactNode {
  switch (token.type) {
    case 'heading': {
      const heading = token as Tokens.Heading;
      const id = ctx.headingIds.get(heading);
      if (!id) {
        return (
          <p className="mt-8 font-display text-[18px] font-bold text-ink">
            <Inline tokens={heading.tokens} />
          </p>
        );
      }
      return heading.depth === 2 ? (
        <h2 id={id} className="mt-14 font-display text-[26px] leading-tight font-extrabold text-ink lg:text-[32px]">
          <Inline tokens={heading.tokens} />
        </h2>
      ) : (
        <h3 id={id} className="mt-10 font-display text-[20px] leading-snug font-bold text-ink lg:text-[22px]">
          <Inline tokens={heading.tokens} />
        </h3>
      );
    }
    case 'paragraph':
      return (
        <p className="mt-5 text-[17px] leading-relaxed">
          <Inline tokens={(token as Tokens.Paragraph).tokens} />
        </p>
      );
    case 'text': {
      const text = token as Tokens.Text;
      return (
        <p className="mt-5 text-[17px] leading-relaxed">
          {text.tokens ? <Inline tokens={text.tokens} /> : text.text}
        </p>
      );
    }
    case 'list': {
      const list = token as Tokens.List;
      const items = list.items.map((item, index) => (
        <li key={String(index)} className="mt-2.5 pl-1.5">
          <Blocks tokens={item.tokens} ctx={ctx} inline />
        </li>
      ));
      return list.ordered ? (
        <ol className="mt-5 list-decimal pl-6 text-[17px] leading-relaxed" start={Number(list.start) || undefined}>
          {items}
        </ol>
      ) : (
        <ul className="mt-5 list-disc pl-6 text-[17px] leading-relaxed">{items}</ul>
      );
    }
    case 'blockquote':
      return (
        <blockquote className="mt-7 border-l-4 border-line pl-5 text-[17px] leading-relaxed text-ink italic">
          <Blocks tokens={(token as Tokens.Blockquote).tokens} ctx={ctx} />
        </blockquote>
      );
    case 'code':
      return (
        <pre className="mt-6 overflow-x-auto rounded-xl border border-line bg-mist2 p-5 text-[14px] leading-relaxed text-ink">
          <code>{(token as Tokens.Code).text}</code>
        </pre>
      );
    case 'table': {
      const table = token as Tokens.Table;
      const label = ctx.tableLabels.get(table);
      return (
        <div
          className="mt-7 overflow-x-auto rounded-xl border border-line"
          role="region"
          tabIndex={0}
          {...(label ? { 'aria-labelledby': label } : { 'aria-label': 'Table' })}
        >
          <table className="w-full min-w-[32rem] border-collapse text-[15.5px]">
            <thead>
              <tr className="bg-mist2">
                {table.header.map((cell, index) => (
                  <th
                    key={String(index)}
                    scope="col"
                    className={`border-b border-line px-4 py-3 font-semibold text-ink ${cellClass(table.align[index] ?? null)}`}
                  >
                    <Inline tokens={cell.tokens} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={String(rowIndex)} className="border-b border-line last:border-0">
                  {row.map((cell, index) => (
                    <td key={String(index)} className={`px-4 py-3 align-top ${cellClass(table.align[index] ?? null)}`}>
                      <Inline tokens={cell.tokens} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'hr':
      return <hr className="mt-10 border-line" />;
    default:
      // Block HTML, link definitions and blank lines render nothing.
      return null;
  }
}

/**
 * A run of body blocks. `inline` renders a list item's single paragraph without a wrapping
 * paragraph, so tight lists read as one line each.
 */
export function Blocks({
  tokens,
  ctx,
  inline = false,
}: {
  tokens: readonly Token[];
  ctx: ArticleBodyContext;
  inline?: boolean;
}): ReactNode {
  if (inline) {
    const first = tokens[0];
    if (tokens.length === 1 && first && (first.type === 'text' || first.type === 'paragraph')) {
      const item = first as Tokens.Text | Tokens.Paragraph;
      return item.tokens ? <Inline tokens={item.tokens} /> : item.text;
    }
  }
  return (
    <>
      {tokens.map((token, index) => (
        <Block key={String(index)} token={token} ctx={ctx} />
      ))}
    </>
  );
}
