import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

function getRiskColor(score: number): string {
  if (score <= 25) return '#22c55e';
  if (score <= 50) return '#eab308';
  if (score <= 75) return '#ef4444';
  return '#991b1b';
}

function getRiskBg(score: number): string {
  if (score <= 25) return '#f0fdf4';
  if (score <= 50) return '#fefce8';
  if (score <= 75) return '#fef2f2';
  return '#fef2f2';
}

let fontCache: ArrayBuffer | null = null;
async function loadFont() {
  if (fontCache) return fontCache;
  const res = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.woff');
  fontCache = await res.arrayBuffer();
  return fontCache;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const isDefault = searchParams.get('default') === 'true';

  if (isDefault) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 'bold', marginBottom: 16, display: 'flex' }}>
            🤖 AXOracle
          </div>
          <div style={{ fontSize: 32, opacity: 0.9, marginBottom: 8, display: 'flex' }}>
            AI가 당신의 직업을 대체할 확률은?
          </div>
          <div style={{ fontSize: 20, opacity: 0.6, display: 'flex' }}>
            3개국 30개 IT 직종의 AI 대체 위험도를 데이터 기반으로 분석합니다
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [{ name: 'NotoSansKR', data: await loadFont(), weight: 700, style: 'normal' as const }],
      }
    );
  }

  const name = searchParams.get('name') || '직업명';
  const nameEn = searchParams.get('name_en') || 'Occupation';
  const score = parseFloat(searchParams.get('score') || '0');
  const level = searchParams.get('level') || 'Low';
  const salary = searchParams.get('salary') || '';
  const riskColor = getRiskColor(score);
  const riskBg = getRiskBg(score);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
          color: 'white',
          padding: 60,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', display: 'flex' }}>🤖 AXOracle</div>
          <div style={{ fontSize: 16, opacity: 0.6, display: 'flex' }}>AI 시대, 당신의 직업은 안전한가요?</div>
        </div>

        {/* Occupation Name */}
        <div style={{ fontSize: 48, fontWeight: 'bold', marginBottom: 8, display: 'flex' }}>{name}</div>
        <div style={{ fontSize: 24, opacity: 0.7, marginBottom: 40, display: 'flex' }}>{nameEn}</div>

        {/* Risk gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {/* Score circle */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: riskBg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: `6px solid ${riskColor}`,
            }}
          >
            <div style={{ fontSize: 48, fontWeight: 'bold', color: riskColor, display: 'flex' }}>
              {score.toFixed(1)}%
            </div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: riskColor, display: 'flex' }}>
              {level}
            </div>
          </div>

          {/* Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 20, opacity: 0.6, display: 'flex' }}>AI 대체 위험도</div>
            </div>
            {/* Bar */}
            <div style={{ width: 500, height: 24, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex' }}>
              <div
                style={{
                  width: `${Math.min(score, 100)}%`,
                  height: '100%',
                  background: riskColor,
                  borderRadius: 12,
                }}
              />
            </div>
            {salary && (
              <div style={{ fontSize: 22, opacity: 0.8, display: 'flex' }}>💰 평균 연봉: {salary}</div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'NotoSansKR', data: await loadFont(), weight: 700, style: 'normal' as const }],
    }
  );
}
