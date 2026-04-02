import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parseColors } from '@/lib/design-system-parser';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gfp/[id]/design-palette-image
 * ds-colors 섹션 content를 파싱하여 팔레트 이미지(PNG) 생성.
 * Slack Block Kit image 블록에서 사용.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ds-color* 섹션 조회
  const res = await query(
    `SELECT content FROM semo.gfp_phase_sections
     WHERE gfp_id = $1 AND section_key LIKE 'ds-color%' AND status != 'rejected'
     ORDER BY ordinal LIMIT 1`,
    [id]
  );

  if (res.rows.length === 0) {
    return new Response('No color section found', { status: 404 });
  }

  const groups = parseColors(res.rows[0].content as string);

  if (groups.length === 0) {
    return new Response('No colors parsed', { status: 404 });
  }

  return new ImageResponse(
    (
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
          Design System — Color Palette
        </div>

        {groups.slice(0, 6).map((group) => (
          <div key={group.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 11, color: '#8080a0', textTransform: 'capitalize' }}>
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
                  <div style={{ display: 'flex', fontSize: 8, color: '#606080' }}>
                    {shade.shade}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
    {
      width: 600,
      height: 200 + groups.slice(0, 6).length * 50,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    }
  );
}
