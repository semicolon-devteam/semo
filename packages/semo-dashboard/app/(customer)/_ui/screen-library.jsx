'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { AGENT_BY_ID, BotAvatar } from './agents';
import { Icon, Eyebrow, Badge, Button, AppShell } from './components';

/*
 * screen-library.jsx — Customer Library (직원 채용, §4.3).
 *
 * Three artboard states:
 *   ScreenLibraryList   — Netflix-style horizontal carousels
 *   ScreenLibraryDetail — agent profile + reviews + 채용하기
 *   ScreenLibraryRecruit— detail screen with 3-step recruit modal
 */

const LIBRARY_EXTRA = [
  /* synthetic library entries beyond the 7 employed agents,
   * so the carousels feel populated */
  { id: 'l1',  name: '메뉴짓기', role: '메뉴 기획 직원',   dept: '메뉴',
    color: 'var(--agent-peach)', accent: '#E07A3B', accessoryKind: 'chart',
    priceTier: 'Pro', rating: 4.6, employers: 392 },
  { id: 'l2',  name: '리뷰리',   role: '리뷰 모니터 직원', dept: 'CS',
    color: 'var(--agent-butter)', accent: '#B27418', accessoryKind: 'heart',
    priceTier: 'Starter', rating: 4.7, employers: 612 },
  { id: 'l3',  name: '예약지기', role: '예약·노쇼 관리',   dept: 'CS',
    color: 'var(--agent-rose)',  accent: '#C66095', accessoryKind: 'clock',
    priceTier: 'Starter', rating: 4.5, employers: 281 },
  { id: 'l4',  name: '광고지기', role: '광고 운영 직원',   dept: '마케팅',
    color: 'var(--agent-lavender)', accent: '#6E5BD1', accessoryKind: 'megaphone',
    priceTier: 'Business', rating: 4.4, employers: 132 },
  { id: 'l5',  name: '발주이',   role: '식자재 발주 직원', dept: '재고',
    color: 'var(--agent-coral)', accent: '#D9543F', accessoryKind: 'box',
    priceTier: 'Pro', rating: 4.8, employers: 423 },
  { id: 'l6',  name: '세무도리', role: '세금·정산 보조',   dept: '회계',
    color: 'var(--agent-mint)',  accent: '#2E9670', accessoryKind: 'calc',
    priceTier: 'Pro', rating: 4.9, employers: 188 },
];

function libraryCard(a) {
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    color: a.color,
    accent: a.accent,
    accessoryKind: a.accessoryKind,
    rating: a.rating,
    employers: a.employers,
    priceTier: a.priceTier,
  };
}

const ROWS = [
  {
    eyebrow: 'Picked for you',
    title: '카페 사장님께 추천하는 직원',
    items: ['jumuni', 'dangol-i', 'algorim-i', 'l2', 'sem-i', 'hwegyedo-ri'],
  },
  {
    eyebrow: 'Customer Care',
    title: '응대·CS 직원',
    items: ['jumuni', 'dangol-i', 'l2', 'l3', 'bi-seo'],
  },
  {
    eyebrow: 'Numbers',
    title: '회계·분석 직원',
    items: ['hwegyedo-ri', 'l6', 'sem-i'],
  },
  {
    eyebrow: 'Marketing',
    title: '마케팅·SNS 직원',
    items: ['algorim-i', 'l4', 'l2'],
  },
  {
    eyebrow: 'Made by Customers',
    title: '사장님들이 직접 만든 직원',
    items: ['l5', 'l1', 'l3'],
    isCommunity: true,
  },
];

function getLibAgent(id) {
  return AGENT_BY_ID[id] || LIBRARY_EXTRA.find(a => a.id === id);
}

/* ─── List view ───────────────────────────────────────────────────── */
function ScreenLibraryList({ listings }) {
  // 실데이터(승인된 카탈로그) → id 인덱스. 정본 7봇은 실데이터로, 합성 l1~l6 은 mock 폴백.
  const realById = Object.fromEntries((listings || []).map((a) => [a.id, a]));
  const resolve = (id) => realById[id] || getLibAgent(id);
  const subtitle = listings && listings.length ? `${listings.length}+ 직원이 일하고 있어요` : '120+ 직원이 일하고 있어요';
  return (
    <AppShell mode="customer" active="library" title="채용"
              subtitle={subtitle}
              topAction={<Button variant="cream" icon="plus">내 봇 공유하기</Button>}>
      <div style={{ height: '100%', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
        {/* Hero */}
        <div style={{
          padding: '28px 32px 16px',
          background: 'linear-gradient(180deg, var(--semo-bg) 0%, var(--semo-bg) 70%, var(--semo-bg-soft) 100%)',
        }}>
          <Eyebrow>Hire</Eyebrow>
          <h1 style={{
            margin: '6px 0 12px', fontSize: 32, fontWeight: 700,
            color: 'var(--semo-fg-1)', letterSpacing: '-0.02em', lineHeight: 1.15,
          }}>새 직원을 만나보세요</h1>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              position: 'relative', flex: 1, maxWidth: 480,
            }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 12 }} color="var(--semo-fg-3)"/>
              <input placeholder="원하는 일을 검색하세요 — 예: 매출 리포트, 카톡 응대"
                     style={{
                       width: '100%',
                       padding: '10px 12px 10px 38px',
                       fontSize: 13.5,
                       background: 'var(--semo-surface)',
                       border: '1px solid var(--semo-line-strong)',
                       borderRadius: 'var(--r-12)',
                       outline: 'none',
                     }}/>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['전체', '카페', '미용실', '쇼핑몰', '컨설턴트', '음식점'].map((t, i) => (
                <button key={t} style={{
                  padding: '6px 14px',
                  fontSize: 13, fontWeight: 600,
                  borderRadius: 'var(--r-full)',
                  background: i === 1 ? 'var(--semo-fg-1)' : 'var(--semo-surface)',
                  color: i === 1 ? 'var(--semo-bg)' : 'var(--semo-fg-2)',
                  border: `1px solid ${i === 1 ? 'var(--semo-fg-1)' : 'var(--semo-line)'}`,
                }}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Carousels */}
        <div style={{ padding: '8px 0 24px', overflow: 'hidden', display: 'grid', gap: 28 }}>
          {ROWS.slice(0, 3).map((row, i) => (
            <LibraryRow key={i} {...row} resolve={resolve}/>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function LibraryRow({ eyebrow, title, items, isCommunity, resolve = getLibAgent }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 32px 12px',
      }}>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h3 style={{
            margin: '4px 0 0', fontSize: 18, fontWeight: 700,
            color: 'var(--semo-fg-1)', letterSpacing: '-0.01em',
          }}>{title}</h3>
        </div>
        <button style={{
          fontSize: 13, color: 'var(--semo-fg-3)', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          모두 보기 <Icon name="arrow-right" size={14}/>
        </button>
      </div>
      <div style={{
        display: 'flex', gap: 14,
        padding: '4px 32px 12px',
        overflow: 'hidden',
      }}>
        {items.map((id, i) => {
          const a = resolve(id);
          if (!a) return null;
          return <LibraryCard key={id} agent={a} primary={i === 0} community={isCommunity}/>;
        })}
        <div style={{ minWidth: 30, flexShrink: 0 }}/>
      </div>
    </div>
  );
}

function LibraryCard({ agent, primary, community }) {
  const a = agent.bio ? agent : libraryCard(agent);
  const bigBio = (agent.bio || `${agent.role}으로 일해요.`).slice(0, 56);
  const pathname = usePathname();
  const base = pathname && pathname.startsWith('/demo') ? '/demo' : '/my';
  return (
    <div onClick={() => { window.location.href = `${base}/library/${a.id || agent.id || ''}`; }} style={{
      flex: '0 0 auto',
      width: primary ? 280 : 220,
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-14)',
      overflow: 'hidden',
      boxShadow: 'var(--semo-shadow-1)',
      cursor: 'pointer',
    }}>
      <div style={{
        height: primary ? 140 : 110,
        background: `linear-gradient(135deg, ${agent.color} 0%, color-mix(in oklab, ${agent.color}, white 30%) 100%)`,
        display: 'grid', placeItems: 'center',
        position: 'relative',
      }}>
        <BotAvatar agent={agent} size={primary ? 92 : 72}/>
        {community && (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(29,36,43,0.85)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            padding: '3px 8px', borderRadius: 'var(--r-full)',
          }}>사장님 제작</span>
        )}
        <span style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(255,255,255,0.92)',
          fontSize: 10.5, fontWeight: 700,
          padding: '3px 6px', borderRadius: 'var(--r-6)',
          display: 'inline-flex', alignItems: 'center', gap: 2,
          color: 'var(--semo-fg-1)',
        }}>
          <Icon name="star-fill" size={10} color="var(--semo-warning)"/>
          <span className="semo-num">{agent.rating?.toFixed?.(1) || '4.7'}</span>
        </span>
      </div>
      <div style={{ padding: 14, display: 'grid', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>{agent.role}</div>
        </div>
        {primary && (
          <div style={{
            fontSize: 12.5, color: 'var(--semo-fg-2)',
            lineHeight: 1.45, height: 36, overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{bigBio}…</div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 2,
        }}>
          <span className="semo-num" style={{ fontSize: 11, color: 'var(--semo-fg-3)' }}>
            {agent.employers}명 채용 중
          </span>
          <Badge tone={agent.priceTier === 'Starter' ? 'primary' :
                       agent.priceTier === 'Pro' ? 'ai' : 'warning'}>
            {agent.priceTier}
          </Badge>
        </div>
      </div>
    </div>
  );
}

/* ─── Detail view ─────────────────────────────────────────────────── */
function ScreenLibraryDetail({ recruitOpen = false, step = 1, slug, agent }) {
  // 실데이터(agent prop) 우선, 없으면 slug→mock, 그래도 없으면 주문이 mock.
  const a = agent || (slug && AGENT_BY_ID[slug]) || AGENT_BY_ID['jumuni'];
  const [open, setOpen] = React.useState(recruitOpen);
  const [curStep, setCurStep] = React.useState(step);
  const [hiring, setHiring] = React.useState(false);
  const pathname = usePathname();
  const base = pathname && pathname.startsWith('/demo') ? '/demo' : '/my';

  // 채용 마법사 마지막 단계 → 실제 install. 데모 테넌트는 API 가 저장 거부(가입 유도).
  async function hire() {
    if (hiring) return;
    setHiring(true);
    try {
      const res = await fetch('/api/my/agents/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: a.id }),
      });
      const j = await res.json();
      if (j.ok) {
        window.location.href = `${base}/team`;
        return;
      }
      window.alert(j.message || '채용에 실패했어요. 잠시 후 다시 시도해주세요.');
      setOpen(false);
    } catch {
      window.alert('채용 요청 중 문제가 발생했어요.');
    } finally {
      setHiring(false);
    }
  }

  return (
    <AppShell mode="customer" active="library" title="채용" subtitle={a.name}>
      <div style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* Detail content */}
        <div style={{
          display: 'grid', gridTemplateColumns: '380px 1fr',
          height: '100%',
        }}>
          {/* Left: hero */}
          <div style={{
            background: `linear-gradient(160deg, ${a.color} 0%, color-mix(in oklab, ${a.color}, white 35%) 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32, flexDirection: 'column', gap: 18,
            borderRight: '1px solid var(--semo-line)',
          }}>
            <BotAvatar agent={a} size={180}/>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                margin: 0, fontSize: 36, fontWeight: 700,
                color: 'var(--semo-fg-1)', letterSpacing: '-0.02em',
              }}>{a.name}</h1>
              <div style={{ fontSize: 14, color: 'var(--semo-fg-2)', marginTop: 6 }}>
                {a.role}
              </div>
            </div>
            <div style={{
              display: 'flex', gap: 16, padding: '12px 18px',
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--r-full)',
              border: '1px solid rgba(255,255,255,0.8)',
            }}>
              <Stat2 label="평점" value={`★ ${a.rating}`}/>
              <div style={{ width: 1, background: 'rgba(0,0,0,0.10)' }}/>
              <Stat2 label="채용 중" value={`${a.employers}명`}/>
              <div style={{ width: 1, background: 'rgba(0,0,0,0.10)' }}/>
              <Stat2 label="플랜" value={a.priceTier}/>
            </div>
          </div>

          {/* Right: details */}
          <div style={{ padding: '28px 36px', display: 'grid', gap: 22, alignContent: 'start',
                        overflow: 'hidden' }}>
            <div>
              <Eyebrow>Self-introduction</Eyebrow>
              <p style={{
                margin: '8px 0 0', fontSize: 17, color: 'var(--semo-fg-2)',
                lineHeight: 1.65, maxWidth: 600,
              }}>
                안녕하세요 사장님, 저는 <strong style={{ color: 'var(--semo-fg-1)' }}>{a.name}</strong> 입니다.{' '}
                {a.bio || `${a.role}으로 일해요. 어려운 결정은 사장님께 바로 여쭤봐요.`}
              </p>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
                  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
                }}>이런 일을 해요</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(a.skills && a.skills.length
                    ? a.skills.map((s) => [s, 'check'])
                    : [
                        ['카카오톡·인스타 DM 응대', 'message'],
                        ['단골 손님 취향 기억', 'star'],
                        ['주문 접수와 변경 처리', 'shopping'],
                        ['응대 만족도 자동 측정', 'thumbsup'],
                        ['어려운 응대는 사장님께 전달', 'flag'],
                      ]
                  ).map(([t, ic]) => (
                    <div key={t} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px',
                      background: 'var(--semo-surface)',
                      border: '1px solid var(--semo-line)',
                      borderRadius: 'var(--r-10)',
                      fontSize: 13, color: 'var(--semo-fg-2)',
                    }}>
                      <Icon name={ic} size={15} color="var(--semo-primary)"/>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
                  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
                }}>필요한 연결</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {a.integrations.map(t => (
                    <div key={t} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px',
                      background: 'var(--semo-cream)',
                      border: '1px solid var(--semo-line-soft)',
                      borderRadius: 'var(--r-10)',
                      fontSize: 13, color: 'var(--semo-fg-2)',
                    }}>
                      <Icon name="zap" size={14} color="var(--semo-warning)"/>
                      <span style={{ flex: 1 }}>{t}</span>
                      <Icon name="lock" size={12} color="var(--semo-fg-3)"/>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: 12, fontSize: 12, color: 'var(--semo-fg-3)',
                  lineHeight: 1.5,
                }}>
                  채용 시 권한 연결 안내를 받으실 수 있어요. 연결 정보는 사장님 가게에만 사용돼요.
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
              }}>다른 사장님들의 후기 ({a.employers}명)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Review name="현지 (베이커리)"
                        text="새벽에 문의 들어와도 다음 날 아침에 깔끔히 정리돼 있어서 좋아요. 단골 알아보는 정확도가 무서울 정도."
                        stars={5}/>
                <Review name="민호 (편집숍)"
                        text="처음엔 어색해서 거의 다 검토했는데, 일주일 지나니 90%는 그냥 맡겨도 되더라구요."
                        stars={5}/>
              </div>
            </div>

            {/* CTA */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px',
              background: 'var(--semo-cream)',
              border: '1px solid var(--semo-line)',
              borderRadius: 'var(--r-14)',
              marginTop: 'auto',
            }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>현재 플랜에 포함</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--semo-fg-1)' }}>
                  Starter 플랜에서 무료로 채용 가능
                </div>
              </div>
              <Button size="lg" variant="primary" iconRight="arrow-right"
                      onClick={() => { setCurStep(1); setOpen(true); }}>
                채용하기
              </Button>
            </div>
          </div>
        </div>

        {/* Recruit modal overlay */}
        {open && <RecruitModal
          step={curStep} agent={a}
          onClose={() => setOpen(false)}
          onPrev={() => setCurStep((s) => Math.max(1, s - 1))}
          onNext={() => (curStep === 3 ? hire() : setCurStep((s) => Math.min(3, s + 1)))}
        />}
      </div>
    </AppShell>
  );
}

function Stat2({ label, value }) {
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 56 }}>
      <span style={{ fontSize: 11, color: 'var(--semo-fg-3)' }}>{label}</span>
      <span className="semo-num" style={{ fontSize: 14, color: 'var(--semo-fg-1)', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Review({ name, text, stars }) {
  return (
    <div style={{
      padding: 12,
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-12)',
    }}>
      <div style={{ display: 'flex', gap: 1, marginBottom: 6 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Icon key={i} name="star-fill" size={12}
                color={i < stars ? 'var(--semo-warning)' : 'var(--semo-line-strong)'}/>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--semo-fg-2)', lineHeight: 1.55 }}>
        “{text}”
      </div>
      <div style={{ fontSize: 11, color: 'var(--semo-fg-3)', marginTop: 8 }}>{name}</div>
    </div>
  );
}

/* ─── Recruit wizard (3 steps) ────────────────────────────────────── */
function RecruitModal({ step, agent, onPrev, onNext, onClose }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(15,17,23,0.36)',
      backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center',
      zIndex: 10,
    }}>
      <div style={{
        width: 540,
        background: 'var(--semo-surface)',
        borderRadius: 'var(--r-20)',
        border: '1px solid var(--semo-line)',
        boxShadow: 'var(--semo-shadow-pop)',
        overflow: 'hidden',
      }}>
        {/* Steps header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--semo-line-soft)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {[
            { n: 1, label: '이름 정하기' },
            { n: 2, label: '권한 연결' },
            { n: 3, label: '첫 인사 받기' },
          ].map((s, i, arr) => {
            const sel = s.n === step;
            const done = s.n < step;
            return (
              <React.Fragment key={s.n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: done ? 'var(--semo-success)' :
                                sel ? 'var(--semo-primary)' : 'var(--semo-surface-3)',
                    color: (sel || done) ? '#fff' : 'var(--semo-fg-3)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {done ? <Icon name="check" size={13} stroke={3}/> : s.n}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: sel ? 600 : 500,
                    color: sel ? 'var(--semo-fg-1)' : 'var(--semo-fg-3)',
                  }}>{s.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ height: 1, background: 'var(--semo-line)', flex: 1 }}/>
                )}
              </React.Fragment>
            );
          })}
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 'var(--r-8)',
            display: 'grid', placeItems: 'center',
            color: 'var(--semo-fg-3)',
          }}><Icon name="x" size={15}/></button>
        </div>

        {/* Step body */}
        <div style={{ padding: 24 }}>
          {step === 1 && <RecruitStep1 agent={agent}/>}
          {step === 2 && <RecruitStep2 agent={agent}/>}
          {step === 3 && <RecruitStep3 agent={agent}/>}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--semo-line-soft)',
          display: 'flex', justifyContent: 'space-between',
          background: 'var(--semo-bg-soft)',
        }}>
          <Button variant="ghost" onClick={onPrev}>이전</Button>
          <Button variant="primary" iconRight={step === 3 ? null : 'arrow-right'} onClick={onNext}>
            {step === 3 ? '시작하기' : '다음'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecruitStep1({ agent }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <BotAvatar agent={agent} size={56}/>
        <div>
          <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>기본 이름</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{agent.name}</div>
        </div>
      </div>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-2)' }}>
          사장님 가게에서 부를 이름을 정해주세요
        </label>
        <input defaultValue="우리 주문이" style={{
          width: '100%', marginTop: 8,
          padding: '12px 14px', fontSize: 15,
          background: 'var(--semo-surface)',
          border: '1.5px solid var(--semo-primary)',
          borderRadius: 'var(--r-10)',
          outline: 'none', boxShadow: 'var(--semo-glow-primary)',
        }}/>
        <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 8, lineHeight: 1.5 }}>
          예시: 우리 주문이, 카운터지기, 정민이. 손님들이 직접 보는 이름은 아니에요.
        </div>
      </div>
    </div>
  );
}

function RecruitStep2({ agent }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--semo-fg-2)', lineHeight: 1.55 }}>
        주문이가 일하려면 아래 도구에 연결해야 해요.
        연결 정보는 사장님 가게 안에서만 사용돼요.
      </div>
      {agent.integrations.map((t, i) => (
        <div key={t} style={{
          padding: 14,
          background: i === 2 ? 'var(--semo-cream)' : 'var(--semo-surface)',
          border: `1px solid ${i === 2 ? 'var(--semo-line)' : 'var(--semo-line)'}`,
          borderRadius: 'var(--r-12)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--r-8)',
            background: 'var(--semo-cream)',
            display: 'grid', placeItems: 'center',
            border: '1px solid var(--semo-line-soft)',
          }}><Icon name="zap" size={16} color="var(--semo-warning)"/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--semo-fg-1)' }}>{t}</div>
            <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>
              {i < 2 ? '카카오 비즈니스 계정으로 1분 안에 연결' : '나중에 연결해도 돼요'}
            </div>
          </div>
          {i < 2 ?
            <Button variant="secondary" size="sm">연결하기</Button> :
            <Badge tone="success" icon="check">건너뛸 수 있음</Badge>
          }
        </div>
      ))}
    </div>
  );
}

function RecruitStep3({ agent }) {
  return (
    <div style={{ display: 'grid', gap: 14, textAlign: 'center', padding: '10px 0' }}>
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        <BotAvatar agent={agent} size={120} state="working"/>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>주문이 첫 인사</div>
        <div style={{
          margin: '10px auto 0', maxWidth: 420,
          padding: '14px 18px',
          background: 'var(--semo-cream)',
          border: '1px solid var(--semo-line-soft)',
          borderRadius: 'var(--r-14)',
          borderBottomLeftRadius: 4,
          fontSize: 14, color: 'var(--semo-fg-2)',
          lineHeight: 1.65, textAlign: 'left',
        }}>
          안녕하세요 사장님! 저는 <strong>우리 주문이</strong>예요.
          오늘부터 카카오톡 응대를 도와드릴게요.
          처음엔 답변을 다 보여드릴 테니, 마음에 들면 알려주세요.
          금방 사장님 스타일에 맞춰갈게요.
        </div>
      </div>
    </div>
  );
}

const ScreenLibraryRecruit = () => <ScreenLibraryDetail recruitOpen step={1}/>;
export { ScreenLibraryList, ScreenLibraryDetail, ScreenLibraryRecruit, LIBRARY_EXTRA };
