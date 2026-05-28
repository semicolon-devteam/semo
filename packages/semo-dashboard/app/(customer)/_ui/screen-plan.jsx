'use client';
import { Icon, Eyebrow, Card, Section, Badge, Button, Progress, SegTab, AppShell } from './components';

/*
 * screen-plan.jsx — Customer Plan & Billing (§4.4).
 */

const PLANS = [
  {
    id: 'free', name: 'Free', price: 0, period: '',
    blurb: '처음 둘러보기',
    color: 'var(--semo-surface)',
    items: [
      ['동시 채용 가능',     '1명'],
      ['월간 AI 사용량',     '300건'],
      ['가게 지식 용량',     '50MB'],
      ['우선 지원',         false],
      ['내 봇 라이브러리 공유', false],
    ],
  },
  {
    id: 'starter', name: 'Starter', price: 29000, period: '월', current: true,
    blurb: '1인 사장님의 시작',
    color: 'var(--semo-cream)',
    items: [
      ['동시 채용 가능',     '3명'],
      ['월간 AI 사용량',     '5,000건'],
      ['가게 지식 용량',     '500MB'],
      ['우선 지원',         '이메일'],
      ['내 봇 라이브러리 공유', false],
    ],
  },
  {
    id: 'pro', name: 'Pro', price: 79000, period: '월', recommended: true,
    blurb: '직원이 더 필요한 가게',
    color: 'var(--semo-primary-08)',
    items: [
      ['동시 채용 가능',     '7명'],
      ['월간 AI 사용량',     '25,000건'],
      ['가게 지식 용량',     '5GB'],
      ['우선 지원',         '카톡 채널'],
      ['내 봇 라이브러리 공유', true],
    ],
  },
  {
    id: 'business', name: 'Business', price: 199000, period: '월',
    blurb: '여러 매장·팀 운영',
    color: 'var(--semo-surface)',
    items: [
      ['동시 채용 가능',     '제한 없음'],
      ['월간 AI 사용량',     '제한 없음'],
      ['가게 지식 용량',     '50GB'],
      ['우선 지원',         '전담 매니저'],
      ['내 봇 라이브러리 공유', true],
    ],
  },
];

function ScreenPlan() {
  return (
    <AppShell mode="customer" active="plan" title="요금제"
              subtitle="Starter · 다음 결제일 6월 28일">
      <div style={{
        height: '100%', overflow: 'hidden',
        padding: '28px 32px',
        display: 'grid', gridTemplateColumns: '1fr 320px',
        gap: 28,
      }}>
        <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
          {/* Current plan + usage hero */}
          <Card padding={24} accent style={{ borderRadius: 'var(--r-16)' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24,
            }}>
              <div>
                <Eyebrow>Current Plan</Eyebrow>
                <h2 style={{
                  margin: '6px 0 4px',
                  fontSize: 30, fontWeight: 700,
                  color: 'var(--semo-fg-1)', letterSpacing: '-0.02em',
                }}>Starter <span style={{ color: 'var(--semo-fg-3)', fontWeight: 500, fontSize: 18 }}>· 월 ₩29,000</span></h2>
                <div style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>
                  다음 결제: 6월 28일 · 카드 신한 4242로 끝나는 카드
                </div>
              </div>
              <Button variant="primary" iconRight="arrow-right">Pro 로 업그레이드</Button>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 22,
            }}>
              <Progress label="AI 응대" sub="1,240 / 5,000" value={1240} max={5000}/>
              <Progress label="가게 지식 용량" sub="124 / 500MB" value={124} max={500}/>
              <Progress label="채용 중인 직원" sub="3 / 3명" value={3} max={3} warning/>
            </div>
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              background: 'var(--semo-warning-bg)',
              border: '1px solid color-mix(in oklab, var(--semo-warning), white 70%)',
              borderRadius: 'var(--r-10)',
              fontSize: 12.5, color: 'var(--semo-fg-2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="warn" size={14} color="var(--semo-warning)"/>
              직원 채용 한도에 도달했어요. 더 많은 직원을 데려오려면 Pro 로 올려주세요.
            </div>
          </Card>

          {/* Plan tiers */}
          <Section eyebrow="Compare" title="플랜 비교"
                   hint="언제든 업·다운그레이드 가능. 다운그레이드는 다음 결제일에 적용돼요."
                   action={<SegTab value="monthly" options={[
                     { value: 'monthly', label: '월간' },
                     { value: 'yearly',  label: '연간 -20%' },
                   ]}/>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {PLANS.map(p => <PlanTier key={p.id} plan={p}/>)}
            </div>
          </Section>

          {/* Bottom: invoices + receipts */}
          <Section eyebrow="Invoices" title="청구서·영수증">
            <Card padding={0}>
              {[
                ['2026-05', '5월 청구서', '₩29,000', '결제 완료', 'success'],
                ['2026-04', '4월 청구서', '₩29,000', '결제 완료', 'success'],
                ['2026-03', '3월 청구서', '₩0',       'Free 사용 중', 'neutral'],
              ].map((row, i, a) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 100px 140px 40px',
                  alignItems: 'center', gap: 16,
                  padding: '14px 18px',
                  borderBottom: i === a.length - 1 ? 'none' : '1px solid var(--semo-line-soft)',
                }}>
                  <span className="semo-num" style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>{row[0]}</span>
                  <span style={{ fontSize: 14, color: 'var(--semo-fg-1)', fontWeight: 500 }}>{row[1]}</span>
                  <span className="semo-num" style={{ fontSize: 14, color: 'var(--semo-fg-1)', fontWeight: 600 }}>{row[2]}</span>
                  <Badge tone={row[4]}>{row[3]}</Badge>
                  <button style={{
                    padding: 4, color: 'var(--semo-fg-3)',
                  }}><Icon name="download" size={15}/></button>
                </div>
              ))}
            </Card>
          </Section>
        </div>

        {/* Right column */}
        <aside style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          {/* Payment method */}
          <Card padding={18}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: 'var(--semo-fg-3)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>결제 수단</div>
              <button style={{ fontSize: 12.5, color: 'var(--semo-primary)', fontWeight: 600 }}>
                추가하기 →
              </button>
            </div>
            <div style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 'var(--r-12)',
              background: 'linear-gradient(135deg, #1D242B 0%, #2C3742 100%)',
              color: '#fff',
              position: 'relative', overflow: 'hidden',
              minHeight: 120,
            }}>
              <div style={{
                position: 'absolute', top: -30, right: -30,
                width: 100, height: 100, borderRadius: '50%',
                background: 'rgba(6,143,255,0.45)', filter: 'blur(20px)',
              }}/>
              <div style={{ fontSize: 11, opacity: 0.65, fontWeight: 600,
                            letterSpacing: '0.1em', textTransform: 'uppercase' }}>신한카드</div>
              <div className="semo-num" style={{
                marginTop: 18, fontSize: 18, fontWeight: 600, letterSpacing: '0.04em',
                fontFamily: 'var(--semo-mono)',
              }}>•••• •••• •••• 4242</div>
              <div style={{
                marginTop: 12, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
                fontSize: 11, opacity: 0.85,
              }}>
                <span>강정민</span>
                <span className="semo-num">04 / 28</span>
              </div>
            </div>
            <div style={{
              marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: 'var(--semo-fg-3)',
            }}>
              <Icon name="lock" size={13}/> 토스페이먼츠로 안전하게 보관 중
            </div>
          </Card>

          {/* Business registration */}
          <Card padding={18}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--semo-fg-3)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
            }}>사업자등록증</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
              정민 카페
            </div>
            <div className="semo-num" style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 2 }}>
              123-45-67890 · 개인사업자
            </div>
            <Badge tone="success" icon="check" style={{ marginTop: 10 }}>
              세금계산서 자동 발행
            </Badge>
          </Card>

          {/* Save tip */}
          <Card padding={18} ai>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--semo-ai-16)', color: 'var(--semo-ai)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}><Icon name="sparkles" size={16} stroke={2}/></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
                  연간 결제로 -20%
                </div>
                <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 4, lineHeight: 1.5 }}>
                  Starter 연간 결제 시 월 ₩23,200 — 한 달치 절약돼요.
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function PlanTier({ plan }) {
  const isCurrent = plan.current;
  const isRec = plan.recommended;
  return (
    <div style={{
      background: plan.color,
      border: `1.5px solid ${isCurrent ? 'var(--semo-primary)' :
                              isRec ? 'var(--semo-ai-16)' : 'var(--semo-line)'}`,
      borderRadius: 'var(--r-14)',
      padding: 18,
      display: 'grid', gap: 14,
      position: 'relative',
      boxShadow: isCurrent ? '0 0 0 3px var(--semo-primary-08)' : 'none',
    }}>
      {isRec && (
        <span style={{
          position: 'absolute', top: -10, right: 18,
          fontSize: 10.5, fontWeight: 700,
          padding: '3px 10px', borderRadius: 'var(--r-full)',
          background: 'var(--semo-ai)', color: '#fff',
          letterSpacing: '0.04em',
        }}>가장 인기</span>
      )}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{plan.name}</span>
          {isCurrent && <Badge tone="primary">현재 사용 중</Badge>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 2 }}>{plan.blurb}</div>
      </div>
      <div>
        <span className="semo-num" style={{
          fontSize: 28, fontWeight: 700, color: 'var(--semo-fg-1)', letterSpacing: '-0.02em',
        }}>
          {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
        </span>
        {plan.period && (
          <span style={{ fontSize: 13, color: 'var(--semo-fg-3)', marginLeft: 4 }}>
            / {plan.period}
          </span>
        )}
      </div>
      <div style={{
        display: 'grid', gap: 7, fontSize: 13,
        padding: '12px 0 0', borderTop: '1px solid var(--semo-line-soft)',
      }}>
        {plan.items.map(([label, v], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {v === false ?
              <Icon name="x" size={13} color="var(--semo-fg-faint)"/> :
              <Icon name="check" size={13} color="var(--semo-success)" stroke={2.5}/>}
            <span style={{ color: 'var(--semo-fg-2)', flex: 1 }}>{label}</span>
            {typeof v === 'string' && (
              <span className="semo-num" style={{ color: 'var(--semo-fg-1)', fontWeight: 600 }}>{v}</span>
            )}
          </div>
        ))}
      </div>
      <Button
        variant={isRec ? 'ai' : isCurrent ? 'secondary' : 'secondary'}
        full
        size="md"
        style={isCurrent ? { color: 'var(--semo-fg-3)' } : null}>
        {isCurrent ? '현재 플랜' : (plan.price === 0 ? '다운그레이드' : '이 플랜으로 변경')}
      </Button>
    </div>
  );
}

export { ScreenPlan };
