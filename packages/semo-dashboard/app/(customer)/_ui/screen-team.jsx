'use client';
import { AGENT_BY_ID, BotAvatar } from './agents';
import { Icon, Badge, Button, SegTab, AppShell, EmptyState } from './components';

/*
 * screen-team.jsx — Customer Team (내 AI 직원, §4.2).
 *
 * Card grid of 7 employed bots + right panel showing selected agent's
 * timeline, recent KB additions, and tool access.
 */

function ScreenTeam({ agents, demo = false }) {
  // 신규 가입자(실 테넌트, 직원 0) → 빈 상태. 데모는 시드 직원이 있어 해당 없음.
  if (!demo && (!agents || agents.length === 0)) {
    return (
      <AppShell mode="customer" active="team" title="내 직원" subtitle="0명">
        <EmptyState
          icon="users"
          title="첫 직원을 채용해보세요"
          sub="라이브러리에서 응대·회계·마케팅 등 필요한 AI 직원을 데려올 수 있어요."
          ctaLabel="직원 채용하기"
          ctaTo="/library"
        />
      </AppShell>
    );
  }
  // agents: 실데이터(설치된 직원) 배열. 없으면 디자인 mock 7명으로 폴백(데모 경로).
  const roster = (agents && agents.length) ? agents : Object.values(AGENT_BY_ID);
  const selected = roster[0];
  const teamMood = (s) =>
    s === 'working' ? '일하는 중' : s === 'resting' ? '쉬는 중' : s === 'error' ? '점검 필요' : '대기';
  return (
    <AppShell mode="customer" active="team" title="내 직원" subtitle="7명 채용 중">
      <div style={{
        height: '100%', display: 'grid', gridTemplateColumns: '1fr 360px',
        overflow: 'hidden',
      }}>
        {/* Main grid */}
        <div style={{ padding: '24px 28px 32px', overflow: 'hidden', display: 'grid', gap: 20 }}>
          {/* Filters + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'all',  label: '전체', count: 7 },
                { id: 'on',   label: '일하는 중', count: 3 },
                { id: 'cs',   label: '응대' },
                { id: 'biz',  label: '회계·분석' },
                { id: 'mkt',  label: '마케팅' },
                { id: 'inv',  label: '재고·발주' },
              ].map((f, i) => {
                const sel = i === 0;
                return (
                  <button key={f.id} style={{
                    padding: '6px 12px',
                    fontSize: 13, fontWeight: 600,
                    borderRadius: 'var(--r-full)',
                    background: sel ? 'var(--semo-fg-1)' : 'var(--semo-surface)',
                    color: sel ? 'var(--semo-bg)' : 'var(--semo-fg-2)',
                    border: `1px solid ${sel ? 'var(--semo-fg-1)' : 'var(--semo-line)'}`,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    {f.label}
                    {f.count != null && <span style={{
                      fontSize: 11, opacity: 0.7, fontWeight: 500,
                    }}>{f.count}</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SegTab value="grid" options={[
                { value: 'grid', label: '카드', icon: 'grid' },
                { value: 'list', label: '리스트', icon: 'list' },
              ]}/>
              <Button variant="primary" icon="plus">새 직원 채용</Button>
            </div>
          </div>

          {/* Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
            alignContent: 'start',
          }}>
            {roster.map((a, i) => (
              <AgentCard key={a.id} agent={a}
                state={a.state || 'idle'}
                metric={a.todaySummary || a.role}
                mood={teamMood(a.state)}
                selected={i === 0}
                dim={a.state === 'resting'}/>
            ))}
            {/* Empty / hire slot */}
            <button style={{
              borderRadius: 'var(--r-14)',
              border: '2px dashed var(--semo-line-strong)',
              background: 'transparent',
              padding: 20,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 10, minHeight: 198,
              color: 'var(--semo-fg-3)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--semo-cream)',
                display: 'grid', placeItems: 'center',
              }}>
                <Icon name="plus" size={22} stroke={2} color="var(--semo-primary)"/>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--semo-fg-2)' }}>
                새 직원 채용
              </div>
              <div style={{ fontSize: 12 }}>120+ 직원이 라이브러리에 있어요</div>
            </button>
          </div>
        </div>

        {/* Right panel — selected agent detail */}
        <aside style={{
          borderLeft: '1px solid var(--semo-line)',
          background: 'var(--semo-bg-soft)',
          padding: '24px 22px',
          display: 'grid', gap: 22,
          alignContent: 'start',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              padding: 12,
              background: 'var(--semo-surface)',
              borderRadius: 'var(--r-16)',
              border: '1px solid var(--semo-line)',
            }}>
              <BotAvatar agent={selected} size={72} state="working"/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--semo-fg-1)' }}>
                {selected.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--semo-fg-3)', marginBottom: 8 }}>
                {selected.role}
              </div>
              <Badge tone="ai" icon="dot">응대 중</Badge>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Button variant="primary" icon="message" full>말 걸기</Button>
            <Button variant="secondary" icon="pause" full>쉬게 하기</Button>
          </div>

          {/* Today's timeline */}
          <div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--semo-fg-3)', letterSpacing: '0.06em',
              textTransform: 'uppercase', marginBottom: 10,
            }}>오늘의 활동 · 9시간</div>
            <Timeline items={[
              { time: '9:48', text: '단골 김미영 님 응대 · ★★★★★', tag: 'success' },
              { time: '9:32', text: '카톡 응대 3건 (평균 1분 20초)', tag: 'success' },
              { time: '9:14', text: '새 단골 박지호 님 등록', tag: 'ai' },
              { time: '8:47', text: '오늘 첫 인사 발송', tag: 'neutral' },
              { time: '8:30', text: '근무 시작', tag: 'neutral' },
            ]}/>
          </div>

          <div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--semo-fg-3)', letterSpacing: '0.06em',
              textTransform: 'uppercase', marginBottom: 10,
            }}>최근 만든 가게 지식</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {[
                ['단골 — 김미영 (5월 28일 갱신)',  'var(--agent-butter)'],
                ['메뉴 — 더치 라떼 추천 톤',       'var(--agent-peach)'],
                ['응대 — 환불 정책 FAQ',           'var(--agent-peach)'],
              ].map(([t, c]) => (
                <a key={t} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  background: 'var(--semo-surface)',
                  border: '1px solid var(--semo-line)',
                  borderRadius: 'var(--r-10)',
                  fontSize: 13, color: 'var(--semo-fg-2)',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: c,
                  }}/>
                  <span style={{ flex: 1 }}>{t}</span>
                  <Icon name="chevron-right" size={14} color="var(--semo-fg-3)"/>
                </a>
              ))}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--semo-fg-3)', letterSpacing: '0.06em',
              textTransform: 'uppercase', marginBottom: 10,
            }}>연결된 도구</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.integrations.map(t => (
                <Badge key={t} tone="cream" icon="zap">{t}</Badge>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

/* ────────────────────────────────────────────────────────────────── */
function AgentCard({ agent, state = 'idle', metric, mood, selected, dim }) {
  const statusInfo = {
    working: { tone: 'ai',      label: '일하는 중', dot: 'var(--semo-ai)' },
    idle:    { tone: 'neutral', label: '대기',     dot: 'var(--semo-success)' },
    resting: { tone: 'neutral', label: '쉬는 중',   dot: 'var(--semo-fg-muted)' },
    error:   { tone: 'danger',  label: '확인 필요', dot: 'var(--semo-danger)' },
  }[state];

  return (
    <div style={{
      background: 'var(--semo-surface)',
      border: `1px solid ${selected ? 'var(--semo-primary)' : 'var(--semo-line)'}`,
      borderRadius: 'var(--r-14)',
      padding: 16,
      display: 'grid', gap: 12,
      boxShadow: selected ? 'var(--semo-shadow-2), 0 0 0 3px var(--semo-primary-12)' : 'var(--semo-shadow-1)',
      opacity: dim ? 0.78 : 1,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <BotAvatar agent={agent} size={56} state={state}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--semo-fg-1)' }}>
              {agent.name}
            </span>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: statusInfo.dot,
              animation: state === 'working' ? 'semo-pulse 1.8s ease-in-out infinite' : 'none',
            }}/>
          </div>
          <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 2 }}>
            {agent.role}
          </div>
        </div>
        <button style={{
          padding: 4, color: 'var(--semo-fg-3)',
        }}><Icon name="more" size={16}/></button>
      </div>

      <div style={{
        padding: '10px 12px',
        background: 'var(--semo-cream)',
        borderRadius: 'var(--r-10)',
        border: '1px solid var(--semo-line-soft)',
      }}>
        <div className="semo-num" style={{
          fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)',
          lineHeight: 1.4,
        }}>{metric}</div>
        <div style={{ fontSize: 11.5, color: 'var(--semo-fg-3)', marginTop: 2 }}>{mood}</div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {agent.skills.slice(0, 3).map(s => (
          <Badge key={s} tone="neutral">{s}</Badge>
        ))}
      </div>
    </div>
  );
}

function Timeline({ items }) {
  return (
    <div style={{ display: 'grid', gap: 0, position: 'relative' }}>
      <div style={{
        position: 'absolute',
        left: 6, top: 8, bottom: 8,
        width: 1, background: 'var(--semo-line-strong)',
      }}/>
      {items.map((it, i) => {
        const c = it.tag === 'ai' ? 'var(--semo-ai)' :
                  it.tag === 'success' ? 'var(--semo-success)' :
                  'var(--semo-fg-faint)';
        return (
          <div key={i} style={{
            display: 'flex', gap: 12,
            padding: '6px 0', alignItems: 'flex-start',
            position: 'relative',
          }}>
            <span style={{
              width: 13, height: 13, borderRadius: '50%',
              background: 'var(--semo-bg-soft)',
              display: 'grid', placeItems: 'center',
              flexShrink: 0, marginTop: 2,
              zIndex: 1,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: c,
              }}/>
            </span>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--semo-fg-2)', lineHeight: 1.45 }}>
              {it.text}
            </div>
            <div className="semo-num" style={{
              fontSize: 11.5, color: 'var(--semo-fg-muted)', whiteSpace: 'nowrap',
            }}>{it.time}</div>
          </div>
        );
      })}
    </div>
  );
}

export { ScreenTeam, AgentCard };
