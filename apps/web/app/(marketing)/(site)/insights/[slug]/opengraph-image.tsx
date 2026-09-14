import { ImageResponse } from 'next/og';
import { getInsightsArticle, getInsightsTopic } from '@/lib/api/insights';

export const alt = 'Calwebtech insights';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/*
 * Token values from packages/config/tailwind/theme.css (ink, cobalt, primary). CSS variables
 * do not reach the image renderer, so they are written out here, as in app/opengraph-image.tsx.
 */
const INK = 'rgb(10, 29, 55)';
const COBALT = 'rgb(18, 58, 143)';
const PRIMARY = 'rgb(21, 80, 224)';

/** The generated social preview of an article, or of a topic listing (docs/03-page-specs.md). */
export default async function InsightsOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await getInsightsTopic(slug);
  const article = topic ? null : await getInsightsArticle(slug);

  const eyebrow = article?.category?.name ?? (topic ? 'Insights' : 'Insights');
  const title = article?.title ?? topic?.copy.title ?? 'Insights';
  const footer = article
    ? [article.author?.name, `${String(article.readingTime)} min read`].filter(Boolean).join(' · ')
    : 'Articles for people buying a website';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          color: 'white',
          background: `linear-gradient(135deg, ${INK} 0%, ${COBALT} 46%, ${PRIMARY} 100%)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
              background: 'white',
              color: INK,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Calwebtech</div>
          <div style={{ fontSize: 26, color: 'rgba(255, 255, 255, 0.75)' }}>{eyebrow}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: title.length > 60 ? 54 : 64, fontWeight: 800, lineHeight: 1.1, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ marginTop: 28, fontSize: 26, color: 'rgba(255, 255, 255, 0.8)' }}>{footer}</div>
        </div>
      </div>
    ),
    size,
  );
}
