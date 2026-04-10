/**
 * Palette Image Renderer — ImageResponse JSX for color palette PNG generation.
 * Shared by:
 *   - /api/projects/[id]/design-palette-image (service context)
 *   - /api/design/palette-image (standalone)
 *   - /api/design/palette-preview/[previewId]/image (preview context)
 */

import { ImageResponse } from 'next/og';
import type { ColorGroup } from '@/lib/design-system-parser';

/**
 * ColorGroup[] → PNG ImageResponse (600×dynamic px).
 * 최대 6개 그룹, 다크 테마.
 */
export function renderPaletteImage(
  groups: ColorGroup[],
  title = 'Design System — Color Palette',
): ImageResponse {
  const visible = groups.slice(0, 6);

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        backgroundColor: '#1a1a2e',
        width: '100%',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', fontSize: 14, color: '#a0a0b0', fontWeight: 600 }}>
        {title}
      </div>

      {visible.map((group) => (
        <div key={group.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 11,
              color: '#8080a0',
              textTransform: 'capitalize',
            }}
          >
            {group.name}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {group.shades.map((shade) => (
              <div
                key={shade.shade}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 28,
                    backgroundColor: shade.hex,
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
                <div style={{ display: 'flex', fontSize: 8, color: '#606080' }}>{shade.shade}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>,
    {
      width: 600,
      height: 200 + visible.length * 50,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    },
  );
}
