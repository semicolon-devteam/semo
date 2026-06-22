'use client';
import { AGENT_BY_ID, BotAvatar } from './agents';
import { Icon, Badge, PhoneFrame } from './components';
import { LIBRARY_EXTRA } from './screen-library';

/*
 * screen-mobile.jsx — Customer mobile screens (Home / Team / Library).
 *
 * Designed at 320×660 inside PhoneFrame. Bottom tab bar:
 * 홈 · 에이전트 · 지식 · 추가 · 더보기.
 */

function MobileTabBar({ active }) {
  const tabs = [
    { id: 'home',  label: '홈',     icon: 'home' },
    { id: 'team',  label: '에이전트', icon: 'users' },
    { id: 'kb',    label: '지식',    icon: 'network' },
    { id: 'lib',   label: '추가',    icon: 'store' },
    { id: 'more',  label: '더보기',  icon: 'more' },
  ];
  return (
    <div style={{
      flexShrink: 0,
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
      padding: '6px 6px 16px',
      background: 'var(--semo-surface)',
      borderTop: '1px solid var(--semo-line)',
    }}>
      {tabs.map(t => {
        const sel = t.id === active;
        return (
          <button key={t.id} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3, padding: '4px 0',
            color: sel ? 'var(--semo-primary)' : 'var(--semo-fg-3)',
          }}>
            <Icon name={t.icon} size={20} stroke={sel ? 2.1 : 1.6}/>
            <span style={{ fontSize: 10.5, fontWeight: sel ? 600 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MobileTopbar({ title, subtitle, action }) {
  return (
    <div style={{
      padding: '8px 18px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--semo-fg-3)', fontWeight: 600 }}>
          {subtitle}
        </div>}
        <h1 style={{
          margin: 0, fontSize: 22, fontWeight: 700,
          color: 'var(--semo-fg-1)', letterSpacing: '-0.02em', lineHeight: 1.15,
        }}>{title}</h1>
      </div>
      {action || (
        <button style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--agent-peach), var(--agent-coral))',
          color: '#fff', fontSize: 12, fontWeight: 700,
        }}>정</button>
      )}
    </div>
  );
}

/* ── Home ─────────────────────────────────────────────────────────── */
function ScreenMobileHome() {
  const jumuni = AGENT_BY_ID['jumuni'];
  const dangol = AGENT_BY_ID['dangol-i'];
  const hwegye = AGENT_BY_ID['hwegyedo-ri'];
  const chaewo = AGENT_BY_ID['chae-wo'];
  return (
    <PhoneFrame label="모바일 · 홈">
      <div style={{
        background: 'var(--semo-bg)',
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <MobileTopbar
          subtitle="화요일 오전 9:47"
          title="안녕하세요, 정민 사장님."/>

        <div style={{
          padding: '0 18px 14px', flex: 1, overflow: 'hidden',
          display: 'grid', gap: 14, alignContent: 'start',
        }}>
          {/* tone-setting subtitle */}
          <div style={{
            fontSize: 13.5, color: 'var(--semo-fg-3)',
            lineHeight: 1.5, marginTop: -8,
          }}>
            오늘 에이전트들이 이런 일을 했어요.
          </div>

          {/* 3 stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MobileStat icon="message" label="오늘 문의" value="14건" delta="+12%"/>
            <MobileStat icon="up"      label="견적 초안" value="6건" delta="+8%"/>
          </div>
          <MobileStat full icon="network" label="이번 주 새 지식도서관 노드"
                      value="8건의 새 노드 · 23개 연결" delta={null}
                      hint="Colony가 에이전트 업무 맥락을 정리했어요"/>

          {/* 사장님이 해주셔야 할 일 */}
          <div style={{
            padding: 14,
            background: 'var(--semo-warning-bg)',
            border: '1px solid color-mix(in oklab, var(--semo-warning), white 70%)',
            borderRadius: 'var(--r-12)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <Icon name="flag" size={16} color="var(--semo-warning)" style={{ marginTop: 2 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--semo-fg-1)' }}>
                3건 확인이 필요해요
              </div>
              <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 2, lineHeight: 1.4 }}>
                문의 답변 · 견적 초안 · 후기 게시
              </div>
            </div>
            <Icon name="chevron-right" size={16} color="var(--semo-fg-3)"/>
          </div>

          {/* Activity */}
          <div style={{
            fontSize: 11, color: 'var(--semo-fg-3)', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            marginTop: 4,
          }}>방금 전</div>
          <MobileFeedItem agent={jumuni} verb="새 문의를 문진했어요"
                          target="싱크대 상판 보수" time="2분 전" status="working"/>
          <MobileFeedItem agent={dangol} verb="이전 고객 맥락을 찾았어요"
                          target="욕실 코킹 재문의" time="8분 전"/>

          <div style={{
            fontSize: 11, color: 'var(--semo-fg-3)', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>오전 9시 ~</div>
          <MobileFeedItem agent={hwegye} verb="견적·입금 리포트를 만들었어요"
                          target="이번 주 요약" time="9:32"/>
          <MobileFeedItem agent={chaewo} verb="방문 체크리스트를 만들었어요"
                          target="마포 욕실 코킹" time="8:47"/>
        </div>

        <MobileTabBar active="home"/>
      </div>
    </PhoneFrame>
  );
}

function MobileStat({ full, icon, label, value, delta, hint }) {
  return (
    <div style={{
      padding: 12,
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-12)',
      display: 'grid', gap: 6,
      gridColumn: full ? '1 / -1' : 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11.5, color: 'var(--semo-fg-3)', fontWeight: 500 }}>
        <span className="semo-ai-chip">AI</span>
        <Icon name={icon} size={12} color="var(--semo-fg-3)"/>
        {label}
      </div>
      <div className="semo-num" style={{
        fontSize: full ? 16 : 22, fontWeight: 700, color: 'var(--semo-fg-1)',
        lineHeight: 1.15, letterSpacing: '-0.02em',
      }}>{value}</div>
      {delta && (
        <Badge tone="success" icon="up">{delta}</Badge>
      )}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--semo-fg-3)' }}>{hint}</div>}
    </div>
  );
}

function MobileFeedItem({ agent, verb, target, time, status }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: 12,
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-12)',
    }}>
      <BotAvatar agent={agent} size={32} state={status}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--semo-fg-1)', lineHeight: 1.4 }}>
          <strong style={{ fontWeight: 600 }}>{agent.name}</strong>
          <span style={{ color: 'var(--semo-fg-3)' }}> 이/가 </span>
          {verb}
        </div>
        <div style={{
          fontSize: 11.5, color: 'var(--semo-fg-2)', marginTop: 2,
          background: 'var(--semo-cream)', padding: '1px 6px',
          borderRadius: 4, display: 'inline-block', fontWeight: 500,
        }}>{target}</div>
      </div>
      <div className="semo-num" style={{
        fontSize: 11, color: 'var(--semo-fg-muted)',
        whiteSpace: 'nowrap', alignSelf: 'flex-start',
      }}>{time}</div>
    </div>
  );
}

/* ── Team ─────────────────────────────────────────────────────────── */
function ScreenMobileTeam() {
  const list = [
    { agent: AGENT_BY_ID['jumuni'],      state: 'working', metric: '오늘 12건 응대' },
    { agent: AGENT_BY_ID['hwegyedo-ri'],  state: 'working', metric: '정산 62% 진행 중' },
    { agent: AGENT_BY_ID['algorim-i'],    state: 'working', metric: '후기 게시물 4개 작성' },
    { agent: AGENT_BY_ID['chae-wo'],      state: 'idle',    metric: '체크리스트 3건' },
    { agent: AGENT_BY_ID['sem-i'],        state: 'idle',    metric: '견적 초안 1건' },
    { agent: AGENT_BY_ID['dangol-i'],     state: 'idle',    metric: '후속관리 47명' },
    { agent: AGENT_BY_ID['bi-seo'],       state: 'resting', metric: '쉬는 중' },
  ];
  return (
    <PhoneFrame label="모바일 · 내 에이전트">
      <div style={{
        background: 'var(--semo-bg)',
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <MobileTopbar
          subtitle="7마리 근무 중"
          title="내 에이전트"
          action={<button style={{
            padding: '6px 12px', borderRadius: 'var(--r-full)',
            background: 'var(--semo-primary)', color: '#fff',
            fontSize: 12, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}><Icon name="plus" size={13} stroke={2.2}/>추가</button>}/>

        {/* filter chips */}
        <div style={{ padding: '0 18px 12px', display: 'flex', gap: 6,
                      flexShrink: 0, overflow: 'hidden' }}>
          {['전체 7', '일하는 중 3', '응대', '견적', '후속'].map((t, i) => (
            <button key={t} style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600,
              borderRadius: 'var(--r-full)',
              background: i === 0 ? 'var(--semo-fg-1)' : 'var(--semo-surface)',
              color: i === 0 ? 'var(--semo-bg)' : 'var(--semo-fg-2)',
              border: `1px solid ${i === 0 ? 'var(--semo-fg-1)' : 'var(--semo-line)'}`,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>{t}</button>
          ))}
        </div>

        <div style={{
          padding: '0 18px 14px', flex: 1, overflow: 'hidden',
          display: 'grid', gap: 8, alignContent: 'start',
        }}>
          {list.map(r => (
            <MobileTeamRow key={r.agent.id} agent={r.agent} state={r.state} metric={r.metric}/>
          ))}
        </div>

        <MobileTabBar active="team"/>
      </div>
    </PhoneFrame>
  );
}

function MobileTeamRow({ agent, state, metric }) {
  const dot = state === 'working' ? 'var(--semo-ai)' :
              state === 'resting' ? 'var(--semo-fg-muted)' : 'var(--semo-success)';
  return (
    <div style={{
      padding: 12,
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-12)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <BotAvatar agent={agent} size={40} state={state}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{agent.name}</span>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: dot,
            animation: state === 'working' ? 'semo-pulse 1.8s ease-in-out infinite' : 'none',
          }}/>
        </div>
        <div style={{ fontSize: 11, color: 'var(--semo-fg-3)' }}>{agent.role}</div>
        <div style={{ fontSize: 11.5, color: 'var(--semo-fg-2)', marginTop: 3, fontWeight: 500 }}>
          {metric}
        </div>
      </div>
      <Icon name="chevron-right" size={16} color="var(--semo-fg-3)"/>
    </div>
  );
}

/* ── Library ──────────────────────────────────────────────────────── */
function ScreenMobileLibrary() {
  return (
    <PhoneFrame label="모바일 · 에이전트">
      <div style={{
        background: 'var(--semo-bg)',
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <MobileTopbar
          subtitle="120+ 에이전트"
          title="필요한 에이전트를 켜보세요"/>

        <div style={{ padding: '0 18px 10px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: 9 }}
                  color="var(--semo-fg-3)"/>
            <input placeholder="원하는 일을 검색하세요"
                   style={{
                     width: '100%', padding: '8px 10px 8px 32px', fontSize: 13,
                     background: 'var(--semo-surface)',
                     border: '1px solid var(--semo-line)',
                     borderRadius: 'var(--r-10)', outline: 'none',
                   }}/>
          </div>
        </div>

        {/* Hero pick */}
        <div style={{ padding: '0 18px 10px', flexShrink: 0 }}>
          <div style={{
            position: 'relative',
            borderRadius: 'var(--r-14)',
            overflow: 'hidden',
            background: `linear-gradient(135deg, var(--agent-peach) 0%, color-mix(in oklab, var(--agent-peach), white 25%) 100%)`,
            padding: 16,
            display: 'flex', alignItems: 'center', gap: 12,
            border: '1px solid var(--semo-line)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--semo-fg-1)',
                            opacity: 0.7, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Today&apos;s pick
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--semo-fg-1)', marginTop: 4 }}>
                토키
              </div>
              <div style={{ fontSize: 12, color: 'var(--semo-fg-2)', marginTop: 1 }}>
                문의 응대와 문진을 도와드려요
              </div>
              <Badge tone="primary" style={{ marginTop: 8 }}>Taste에서 사용 가능</Badge>
            </div>
            <BotAvatar agent={AGENT_BY_ID['jumuni']} size={72}/>
          </div>
        </div>

        <div style={{ padding: '0 18px 14px', flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: 11, color: 'var(--semo-fg-3)', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            marginBottom: 10, marginTop: 8,
          }}>응대·후속관리 에이전트</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              AGENT_BY_ID['dangol-i'],
              LIBRARY_EXTRA[1],
              LIBRARY_EXTRA[2],
              AGENT_BY_ID['bi-seo'],
            ].map(a => (
              <MobileLibraryCard key={a.id} agent={a}/>
            ))}
          </div>
        </div>

        <MobileTabBar active="lib"/>
      </div>
    </PhoneFrame>
  );
}

function MobileLibraryCard({ agent }) {
  return (
    <div style={{
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-12)',
      overflow: 'hidden',
    }}>
      <div style={{
        height: 70,
        background: `linear-gradient(135deg, ${agent.color}, color-mix(in oklab, ${agent.color}, white 35%))`,
        display: 'grid', placeItems: 'center',
      }}>
        <BotAvatar agent={agent} size={48}/>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{agent.name}</div>
        <div style={{ fontSize: 11, color: 'var(--semo-fg-3)' }}>{agent.role}</div>
        <div style={{
          marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span className="semo-num" style={{
            fontSize: 10.5, color: 'var(--semo-fg-3)',
            display: 'inline-flex', alignItems: 'center', gap: 2,
          }}>
            <Icon name="star-fill" size={10} color="var(--semo-warning)"/>
            {agent.rating?.toFixed?.(1) || '4.7'}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: agent.priceTier === 'Taste' ? 'var(--semo-primary)' :
                   agent.priceTier === 'Core' ? 'var(--semo-ai)' : 'var(--semo-warning)',
          }}>{agent.priceTier}</span>
        </div>
      </div>
    </div>
  );
}

export { ScreenMobileHome, ScreenMobileTeam, ScreenMobileLibrary };
