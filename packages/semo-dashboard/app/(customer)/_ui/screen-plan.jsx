'use client';
import { Icon, Eyebrow, Card, Section, Badge, Button, Progress, SegTab, AppShell } from './components';

/*
 * screen-plan.jsx — Customer Plan & Billing (§4.4).
 */

const PLANS = [
  {
    id: 'taste', name: 'Taste', price: 100000, period: '월', current: true,
    blurb: '에이전트 팀을 가볍게 경험',
    color: 'var(--semo-cream)',
    items: [
      ['월 제공 먹이',       '800개'],
      ['초기 에이전트 팀',   '최소 구성'],
      ['지식도서관 용량',    '500MB'],
      ['승인형 자동화',      true],
      ['직접 커스텀 지원',   false],
    ],
  },
  {
    id: 'core', name: 'Core', price: 300000, period: '월', recommended: true,
    blurb: '실제로 유용하게 쓰는 주력 플랜',
    color: 'var(--semo-primary-08)',
    items: [
      ['월 제공 먹이',       '3,000개'],
      ['초기 에이전트 팀',   '전체 기능'],
      ['지식도서관 용량',    '5GB'],
      ['모든 자동화 기능',   true],
      ['외부 연동 추가 과금', '별도'],
    ],
  },
  {
    id: 'deep', name: 'Deep', price: 500000, period: '월',
    blurb: '깊은 사용과 운영 지원',
    color: 'var(--semo-surface)',
    items: [
      ['월 제공 먹이',       '6,000개'],
      ['초기 에이전트 팀',   '전체 기능'],
      ['지식도서관 용량',    '20GB'],
      ['비즈니스아워 특별 대응', true],
      ['직접 커스텀 지원',   true],
    ],
  },
  {
    id: 'install', name: 'Install', price: 0, period: '별도',
    blurb: '고객 환경 설치형',
    color: 'var(--semo-surface)',
    items: [
      ['설치형 계약',       '별도 견적'],
      ['고객 인프라 배포',   true],
      ['지식도서관 Export', true],
      ['보안·운영 협의',    true],
      ['월 먹이',           '계약별'],
    ],
  },
];

function planColor(p) {
  if (p.recommended) return 'var(--semo-primary-08)';
  if (p.current) return 'var(--semo-cream)';
  return 'var(--semo-surface)';
}

// 실 billing → mock PLANS 호환 shape 로 매핑(PlanTier 가 기대하는 형태).
function toTier(p) {
  return {
    id: p.slug,
    name: p.name,
    price: p.priceKrw,
    period: p.period === 'month' ? '월' : p.period === 'year' ? '년' : '',
    blurb: p.blurb,
    color: planColor(p),
    items: p.features,
    current: p.current,
    recommended: p.recommended,
  };
}

function fmtUsageSub(m) {
  if (m.metric === 'ai_responses') return `${m.used.toLocaleString()} / ${m.limit != null ? m.limit.toLocaleString() : '∞'}개`;
  if (m.metric === 'kb_storage_mb') return `${m.used} / ${m.limit ?? '∞'}MB`;
  if (m.metric === 'employees') return `${m.used} / ${m.limit ?? '∞'}마리`;
  return `${m.used.toLocaleString()} / ${m.limit != null ? m.limit.toLocaleString() : '∞'}`;
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function ScreenPlan({ billing }) {
  const hasReal = billing && Array.isArray(billing.plans) && billing.plans.length > 0;
  const plans = hasReal ? billing.plans.map(toTier) : PLANS;
  const current = plans.find((p) => p.current) || plans.find((p) => p.id === 'taste') || plans[0];
  const usage = hasReal && billing.usage.length ? billing.usage : null;
  const invoices = hasReal && billing.invoices.length ? billing.invoices : null;
  const pm = hasReal ? billing.paymentMethod : null;
  const nextBilling = hasReal ? fmtDate(billing.nextBillingAt) : '6월 28일';
  const priceLabel = current && current.price ? `₩${current.price.toLocaleString()}` : '별도 계약';

  return (
    <AppShell mode="customer" active="plan" title="요금제·먹이"
              subtitle={`${current?.name || 'Taste'} · 다음 결제일 ${nextBilling || '6월 28일'}`}>
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
                }}>{current?.name || 'Taste'} <span style={{ color: 'var(--semo-fg-3)', fontWeight: 500, fontSize: 18 }}>· 월 {priceLabel}</span></h2>
                <div style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>
                  다음 결제: {nextBilling || '6월 28일'}
                  {pm?.brand ? ` · ${pm.brand} ${pm.last4 || ''}로 끝나는 카드` : ' · 카드 신한 4242로 끝나는 카드'}
                </div>
              </div>
              <Button variant="primary" iconRight="arrow-right">Core 로 업그레이드</Button>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 22,
            }}>
              {usage ? (
                usage.slice(0, 3).map((m) => (
                  <Progress
                    key={m.metric}
                    label={m.label}
                    sub={fmtUsageSub(m)}
                    value={m.used}
                    max={m.limit ?? m.used}
                    warning={m.limit != null && m.used >= m.limit}
                  />
                ))
              ) : (
                <>
                  <Progress label="이번 달 먹이" sub="240 / 800개" value={240} max={800}/>
                  <Progress label="지식도서관 용량" sub="124 / 500MB" value={124} max={500}/>
                  <Progress label="일하는 에이전트" sub="3 / 7마리" value={3} max={7}/>
                </>
              )}
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
              Taste 플랜은 최소 팀 기준 1~2주 안에 먹이가 대부분 소진되도록 설계돼요. 계속 쓰려면 Core 를 추천합니다.
            </div>
          </Card>

          {/* Plan tiers */}
          <Section eyebrow="Compare" title="플랜 비교"
                   hint="기능 차등은 작게 두고, 플랜별 월 먹이 제공량과 지원 깊이로 조절합니다."
                   action={<SegTab value="monthly" options={[
                     { value: 'monthly', label: '월간' },
                     { value: 'yearly',  label: '연간 -20%' },
                   ]}/>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {plans.map(p => <PlanTier key={p.id} plan={p}/>)}
            </div>
          </Section>

          {/* Bottom: invoices + receipts */}
          <Section eyebrow="Invoices" title="청구서·영수증">
            <Card padding={0}>
              {(invoices
                ? invoices.map((inv) => {
                    const d = new Date(inv.occurredAt);
                    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const statusLabel = inv.status === 'paid' ? '결제 완료' : inv.status === 'free' ? 'Free 사용 중' : inv.status === 'pending' ? '대기' : '실패';
                    const tone = inv.status === 'paid' ? 'success' : inv.status === 'failed' ? 'danger' : 'neutral';
                    return [ym, inv.label, `₩${inv.amountKrw.toLocaleString()}`, statusLabel, tone];
                  })
                : [
                    ['2026-05', '5월 청구서', '₩100,000', '결제 완료', 'success'],
                    ['2026-04', '4월 청구서', '₩100,000', '결제 완료', 'success'],
                    ['2026-03', '파일럿 청구서', '₩100,000', '결제 완료', 'success'],
                  ]
              ).map((row, i, a) => (
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
                            letterSpacing: '0.1em', textTransform: 'uppercase' }}>{pm?.brand || '신한카드'}</div>
              <div className="semo-num" style={{
                marginTop: 18, fontSize: 18, fontWeight: 600, letterSpacing: '0.04em',
                fontFamily: 'var(--semo-mono)',
              }}>•••• •••• •••• {pm?.last4 || '4242'}</div>
              <div style={{
                marginTop: 12, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
                fontSize: 11, opacity: 0.85,
              }}>
                <span>{pm?.holder || '강정민'}</span>
                <span className="semo-num">{pm?.exp || '04 / 28'}</span>
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
              현대 인테리어
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
                  Core 이상부터 전체 기능 오픈
                </div>
                <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 4, lineHeight: 1.5 }}>
                  Deep 플랜은 비즈니스아워 특별 대응과 직접 커스텀 지원이 포함돼요.
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
  const priceText = plan.id === 'install'
    ? '별도 계약'
    : plan.price === 0
      ? '무료'
      : `₩${plan.price.toLocaleString()}`;
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
          {priceText}
        </span>
        {plan.period && plan.id !== 'install' && (
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
        {isCurrent ? '현재 플랜' : (plan.id === 'install' ? '상담 요청' : '이 플랜으로 변경')}
      </Button>
    </div>
  );
}

export { ScreenPlan };
