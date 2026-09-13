import type { HomePageContent } from '@calwebtech/shared';
import { BackdropImage } from '../ui/brand';
import { BackgroundVideo } from './background-video';

/**
 * Poster image in the base layer with a slow drift, and a muted video over it once it can
 * play. Neither renders without media in the content, so a missing file never shows a
 * black frame or logs an error.
 */
export function BackgroundMedia({
  background,
  posterClassName,
  priority = false,
}: {
  background: HomePageContent['hero']['background'];
  posterClassName: string;
  priority?: boolean;
}) {
  return (
    <>
      {background.poster ? (
        <BackdropImage image={background.poster} className={`kenburns ${posterClassName}`} priority={priority} />
      ) : null}
      {background.videoUrl ? <BackgroundVideo src={background.videoUrl} /> : null}
    </>
  );
}
