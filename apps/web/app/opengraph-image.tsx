import { ImageResponse } from 'next/og';

export const alt = 'Calwebtech: custom websites, commerce platforms and web applications';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/*
 * Token values from packages/config/tailwind/theme.css (ink, cobalt, primary). CSS variables
 * do not reach the image renderer, so the band gradient is written out here.
 */
const INK = 'rgb(10, 29, 55)';
const COBALT = 'rgb(18, 58, 143)';
const PRIMARY = 'rgb(21, 80, 224)';

/**
 * The social preview for any page without an image of its own (lib/seo/metadata.ts). Built
 * once at build time; it reads no data, so it needs no API.
 */
export default function OpengraphImage() {
  return new ImageResponse(
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 18,
            background: 'white',
            color: INK,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 46,
            fontWeight: 800,
          }}
        >
          C
        </div>
        <div style={{ fontSize: 46, fontWeight: 800 }}>Calwebtech</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.08, maxWidth: 960 }}>
          Custom websites, commerce platforms and web applications
        </div>
        <div style={{ marginTop: 30, fontSize: 30, color: 'rgba(255, 255, 255, 0.8)', maxWidth: 960 }}>
          For companies that would rather own their platform than rent it.
        </div>
      </div>
    </div>,
    size,
  );
}
