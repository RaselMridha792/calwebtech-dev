import type { Ground } from './section';

/**
 * The two or three sentence direct answer that opens every service, industry and location
 * page, straight under the H1 and before anything promotional (CLAUDE.md, SEO rules). It is
 * the extraction target for AI answer engines, so it is plain text in a paragraph,
 * validated by `answerBlockSchema`. `data-answer-block` lets end-to-end tests find it.
 */
export function AnswerBlock({
  children,
  ground = 'light',
  className = '',
}: {
  children: string;
  ground?: Ground;
  className?: string;
}) {
  return (
    <p
      data-answer-block=""
      className={`max-w-[68ch] border-l-4 pl-5 text-[18px] leading-relaxed lg:text-[19px] ${ground === 'dark' ? 'border-white/35 text-white/90' : 'border-primary text-ink'} ${className}`}
    >
      {children}
    </p>
  );
}
