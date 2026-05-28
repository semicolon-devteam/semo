'use client';
import { BotAvatar } from './agents';
import {
  Icon, Eyebrow, Card, Section, Badge, Button, Progress, SegTab, AppShell,
  ActivityFeedItem, NudgeItem, MiniBarChart, MiniLineChart,
} from './components';
import { PersonaProvider, usePersona, PERSONA_BY_ID, PACK_SHOP } from './personas';

/*
 * screen-persona.jsx — Persona-aware Home / Library / Plan / Knowledge.
 *
 * Same chrome (AppShell), same atoms (Card, Badge, Button, etc.), same
 * sections — only the strings, agents, stats, and feed events come from
 * the current persona pack.
 *
 * Compared to the original 소상공인-only screens this file replaces:
 *   - Greeting copy, eyebrows, CTAs come from pack.{home|library|plan}.*
 *   - Agents are pack.agents (not global AGENT_BY_ID), so avatars swap
 *   - Feed rows are pack.home.feed.* (groups: now / morning / yesterday)
 *
 * Each screen also calls `setActivePersonaAgents(pack)` once so that
 * legacy artboards reading the global `AGENT_BY_ID` keep showing the
 * correct roster while a persona is active in their scope.
 */

/* Helper — wraps an artboard child in PersonaProvider so usePersona() works.
 *
 * NOTE: an earlier version of this scope mutated window.AGENT_BY_ID to swap
 * the global roster for the duration. That breaks the moment >1 PersonaScope
 * renders in the same React tree (canvas has 3 personas × 3 screens) — last
 * render wins and every legacy screen reading AGENT_BY_ID['jumuni'] crashes.
 * Persona-aware screens look up agents through `pack.agents.find(...)` so the
 * mutation is not needed. */
function PersonaScope({ persona, children }) {
  const pack = typeof persona === 'string'
    ? (PERSONA_BY_ID[persona] || PACK_SHOP)
    : persona;
  return <PersonaProvider persona={pack}>{children}</PersonaProvider>;
}

/* ════════════════════════════════════════════════════════════════════
 * Home (§4.6) — persona-aware
 * ══════════════════════════════════════════════════════════════════ */
function PersonaHome({ persona }) {
  return (
    <PersonaScope persona={persona}>
      <PersonaHomeInner/>
    </PersonaScope>
  );
}

function PersonaHomeInner() {
  const p = usePersona();
  const ag = id => p.agents.find(a => a.id === id);
  return (
    <AppShell mode="customer" active="home"
              workspace={p.workspace.name}
              title="홈"
              subtitle="화요일 · 5월 28일"
              onModeToggle={null}>
      <div style={{
        height: '100%', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '1fr 340px',
      }}>
        {/* Left main */}
        <div style={{ padding: '28px 32px 40px', display: 'grid', gap: 24,
                      alignContent: 'start', overflow: 'hidden' }}>
          {/* Greeting + stats */}
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Eyebrow>{p.home.eyebrow}</Eyebrow>
                <Badge tone="cream">
                  <Icon name={p.icon} size={11} stroke={2}/>
                  &nbsp;{p.label} 모드
                </Badge>
              </div>
              <h1 style={{
                margin: '8px 0 0', fontSize: 'var(--t-display)', lineHeight: 1.12,
                fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--semo-fg-1)',
              }}>
                {p.home.greetingTitle}<br/>
                <span style={{ color: 'var(--semo-fg-3)', fontWeight: 600 }}>
                  {p.home.greetingSubtitle}
                </span>
              </h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {p.home.stats.map((s, i) => (
                <PersonaStat key={i} stat={s}/>
              ))}
            </div>
          </div>

          {/* Feed */}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--semo-line-soft)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="inbox" size={18} color="var(--semo-fg-2)"/>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600,
                             color: 'var(--semo-fg-1)' }}>{p.home.feedTitle}</h3>
                <Badge tone="primary">
                  {p.home.feed.now.length + p.home.feed.morning.length + p.home.feed.yesterday.length}
                </Badge>
              </div>
              <SegTab value="all" options={[
                { value: 'all',  label: '전체' },
                { value: 'ai',   label: 'AI 가 한 일' },
                { value: 'wait', label: '내 결정 대기' },
              ]}/>
            </div>

            <FeedGroupP label="방금 전" rows={p.home.feed.now} ag={ag}/>
            <FeedGroupP label="오전 9시 ~" rows={p.home.feed.morning} ag={ag}/>
            <FeedGroupP label="어제" rows={p.home.feed.yesterday} ag={ag} last/>
          </Card>
        </div>

        {/* Right sidebar */}
        <aside style={{
          borderLeft: '1px solid var(--semo-line)',
          background: 'var(--semo-bg-soft)',
          padding: '28px 24px',
          display: 'grid', gap: 24,
          alignContent: 'start', overflow: 'hidden',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="flag" size={16} color="var(--semo-warning)"/>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600,
                           color: 'var(--semo-fg-1)' }}>{p.home.nudgeTitle}</h3>
              <Badge tone="warning">{p.home.nudges.length}</Badge>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {p.home.nudges.map((n, i) => (
                <NudgeItem key={i}
                  agent={ag(n.agentId)}
                  title={n.title} detail={n.detail}
                  primary={n.primary} secondary={n.secondary}/>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--semo-ai)',
                boxShadow: '0 0 0 4px var(--semo-ai-16)',
                animation: 'semo-pulse 1.8s ease-in-out infinite',
              }}/>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600,
                           color: 'var(--semo-fg-1)' }}>{p.home.workingTitle}</h3>
            </div>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              {p.home.working.map((w, i) => {
                const a = ag(w.agentId);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    borderBottom: i === p.home.working.length - 1 ? 'none' : '1px solid var(--semo-line-soft)',
                  }}>
                    <BotAvatar agent={a} size={32} state="working"/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)' }}>{a.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--semo-fg-3)' }}>{w.task}</div>
                      {w.progress != null && (
                        <div style={{
                          height: 3, background: 'var(--semo-surface-3)',
                          borderRadius: 'var(--r-full)', marginTop: 4, overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${w.progress}%`, height: '100%', background: 'var(--semo-ai)',
                            borderRadius: 'var(--r-full)',
                          }}/>
                        </div>
                      )}
                    </div>
                    <span className="semo-num" style={{
                      fontSize: 11, color: 'var(--semo-ai)', fontWeight: 600,
                    }}>{w.detail}</span>
                  </div>
                );
              })}
            </Card>
          </div>

          <Card padding={16}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--r-10)',
                background: 'var(--semo-primary-08)', color: 'var(--semo-primary)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}><Icon name="network" size={18} stroke={2}/></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)' }}>{p.home.weekKB}</div>
                <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 2 }}>{p.home.weekKBSub}</div>
              </div>
              <Icon name="chevron-right" size={16} color="var(--semo-fg-3)"/>
            </div>
            <div style={{ height: 64, marginTop: 12 }}>
              <KBPreviewMini/>
            </div>
          </Card>

          <Card padding={16} accent>
            <Progress label={p.home.planLabel} sub="1,240 / 5,000"
                      value={1240} max={5000}/>
            <div style={{ fontSize: 12, color: 'var(--semo-fg-3)',
                          marginTop: 10, lineHeight: 1.5 }}>
              이번 달 한도 25% 사용 중. Starter 플랜 · 매월 1일 갱신.
            </div>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function PersonaStat({ stat }) {
  const deltaTone = stat.delta == null ? null : (stat.delta >= 0 ? 'success' : 'danger');
  const chart =
    stat.chart === 'line'    ? <MiniLineChart data={stat.data} width={140} height={32}/> :
    stat.chart === 'bar'     ? <MiniBarChart data={stat.data} width={140} height={32}/> :
    stat.chart === 'network' ? <KBPreviewSpark/> :
    null;
  return (
    <Card padding={18}>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--semo-fg-3)', fontWeight: 500,
        }}>
          <span className="semo-ai-chip">AI</span>
          {stat.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end',
                      justifyContent: 'space-between', gap: 8 }}>
          <div className="semo-num" style={{
            fontSize: 30, lineHeight: 1.1, fontWeight: 700,
            color: 'var(--semo-fg-1)', letterSpacing: '-0.02em',
          }}>{stat.value}</div>
          {chart}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {deltaTone && (
            <Badge tone={deltaTone} icon={stat.delta >= 0 ? 'up' : 'down'}>
              {stat.delta >= 0 ? '+' : ''}{stat.delta}%
            </Badge>
          )}
          {stat.hint && <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>{stat.hint}</div>}
        </div>
      </div>
    </Card>
  );
}

function FeedGroupP({ label, rows, ag, last }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div style={{
      borderBottom: last ? 'none' : '1px solid var(--semo-line-soft)',
      padding: '4px 6px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '8px 14px 4px',
      }}>{label}</div>
      {rows.map((r, i) => (
        <ActivityFeedItem key={i}
          agent={ag(r.agent)}
          verb={r.verb} target={r.target} detail={r.detail}
          time={r.time} status={r.status}/>
      ))}
    </div>
  );
}

function KBPreviewSpark() {
  return (
    <svg width="140" height="32" viewBox="0 0 140 32">
      <line x1="20" y1="20" x2="60" y2="10" stroke="var(--semo-line-strong)" strokeWidth="1"/>
      <line x1="60" y1="10" x2="100" y2="22" stroke="var(--semo-line-strong)" strokeWidth="1"/>
      <line x1="60" y1="10" x2="120" y2="14" stroke="var(--semo-primary)" strokeWidth="1.2"/>
      <line x1="20" y1="20" x2="100" y2="22" stroke="var(--semo-line-strong)" strokeWidth="1"/>
      <circle cx="20" cy="20" r="3" fill="var(--agent-mint)"/>
      <circle cx="60" cy="10" r="4" fill="var(--agent-peach)"/>
      <circle cx="100" cy="22" r="3" fill="var(--agent-lavender)"/>
      <circle cx="120" cy="14" r="3.5" fill="var(--semo-primary)"/>
    </svg>
  );
}
function KBPreviewMini() {
  const nodes = [
    { x: 30, y: 22, c: 'var(--agent-peach)',    r: 5 },
    { x: 64, y: 14, c: 'var(--agent-mint)',     r: 4 },
    { x: 96, y: 30, c: 'var(--agent-lavender)', r: 5 },
    { x: 140, y: 18, c: 'var(--agent-sky)',     r: 4 },
    { x: 170, y: 36, c: 'var(--agent-butter)',  r: 5 },
    { x: 200, y: 16, c: 'var(--agent-coral)',   r: 4 },
    { x: 240, y: 30, c: 'var(--agent-rose)',    r: 5 },
    { x: 50, y: 48, c: 'var(--semo-primary)',   r: 4 },
    { x: 120, y: 50, c: 'var(--agent-peach)',   r: 3.5 },
    { x: 215, y: 50, c: 'var(--agent-mint)',    r: 3.5 },
  ];
  return (
    <svg width="100%" height="64" viewBox="0 0 280 64" preserveAspectRatio="xMidYMid meet">
      {nodes.flatMap((a, i) => nodes.slice(i + 1).map((b, j) => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 70) return null;
        return <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                     stroke="var(--semo-line-strong)" strokeWidth="0.8" opacity={1 - d / 70}/>;
      }))}
      {nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.c}/>)}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════
 * Library — persona-aware
 * ══════════════════════════════════════════════════════════════════ */
function PersonaLibrary({ persona }) {
  return (
    <PersonaScope persona={persona}>
      <PersonaLibraryInner/>
    </PersonaScope>
  );
}

function PersonaLibraryInner() {
  const p = usePersona();
  // Build carousels: row0 = first 6 agents (picked-for-you); rows 1/2 = filtered slices
  const all = p.agents;
  const rows = [
    { ...p.library.rows[0], items: all.slice(0, 6) },
    { ...p.library.rows[1], items: all.slice(0, 4).reverse() },
    { ...p.library.rows[2], items: all.slice(2, 6) },
  ];
  return (
    <AppShell mode="customer" active="library"
              workspace={p.workspace.name}
              title={p.library.title} subtitle={p.library.subtitle}
              topAction={<Button variant="cream" icon="plus">내 봇 공유하기</Button>}>
      <div style={{ height: '100%', overflow: 'hidden',
                    display: 'grid', gridTemplateRows: 'auto 1fr' }}>
        {/* Hero */}
        <div style={{
          padding: '28px 32px 16px',
          background: 'linear-gradient(180deg, var(--semo-bg) 0%, var(--semo-bg) 70%, var(--semo-bg-soft) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eyebrow>{p.library.heroEyebrow}</Eyebrow>
            <Badge tone="cream">
              <Icon name={p.icon} size={11} stroke={2}/>
              &nbsp;{p.label}
            </Badge>
          </div>
          <h1 style={{
            margin: '6px 0 12px', fontSize: 32, fontWeight: 700,
            color: 'var(--semo-fg-1)', letterSpacing: '-0.02em', lineHeight: 1.15,
          }}>{p.library.heroTitle}</h1>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
              <Icon name="search" size={16}
                    style={{ position: 'absolute', left: 12, top: 12 }}
                    color="var(--semo-fg-3)"/>
              <input placeholder={p.library.searchPlaceholder} style={{
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
              {p.library.audienceChips.map(t => (
                <button key={t} style={{
                  padding: '6px 14px',
                  fontSize: 13, fontWeight: 600,
                  borderRadius: 'var(--r-full)',
                  background: t === p.library.audienceActive ? 'var(--semo-fg-1)' : 'var(--semo-surface)',
                  color: t === p.library.audienceActive ? 'var(--semo-bg)' : 'var(--semo-fg-2)',
                  border: `1px solid ${t === p.library.audienceActive ? 'var(--semo-fg-1)' : 'var(--semo-line)'}`,
                }}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Carousels */}
        <div style={{ padding: '8px 0 24px', overflow: 'hidden', display: 'grid', gap: 28 }}>
          {rows.map((row, ri) => (
            <div key={ri}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                padding: '0 32px 12px',
              }}>
                <div>
                  <Eyebrow>{row.eyebrow}</Eyebrow>
                  <h3 style={{
                    margin: '4px 0 0', fontSize: 18, fontWeight: 700,
                    color: 'var(--semo-fg-1)', letterSpacing: '-0.01em',
                  }}>{row.title}</h3>
                </div>
                <button style={{
                  fontSize: 13, color: 'var(--semo-fg-3)', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  모두 보기 <Icon name="arrow-right" size={14}/>
                </button>
              </div>
              <div style={{
                display: 'flex', gap: 14, padding: '4px 32px 12px', overflow: 'hidden',
              }}>
                {row.items.map((a, i) => (
                  <PersonaLibraryCard key={a.id} agent={a} primary={i === 0} cta={p.library.cta}/>
                ))}
                <div style={{ minWidth: 30, flexShrink: 0 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function PersonaLibraryCard({ agent, primary }) {
  const ratings = { jumuni: 4.8, 'hwegyedo-ri': 4.9, 'algorim-i': 4.6,
                    'eui-ri': 4.7, 'mind-i': 4.8, 'meeting-i': 4.9,
                    'data-yi': 4.8, 'report-i': 4.7 };
  const rating  = ratings[agent.id] || 4.7;
  const employers = (agent.id.charCodeAt(0) * 17 % 900) + 120;
  return (
    <div style={{
      flex: '0 0 auto',
      width: primary ? 280 : 220,
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-14)',
      overflow: 'hidden',
      boxShadow: 'var(--semo-shadow-1)',
    }}>
      <div style={{
        height: primary ? 140 : 110,
        background: `linear-gradient(135deg, ${agent.color} 0%, color-mix(in oklab, ${agent.color}, white 30%) 100%)`,
        display: 'grid', placeItems: 'center', position: 'relative',
      }}>
        <BotAvatar agent={agent} size={primary ? 92 : 72}/>
        <span style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(255,255,255,0.92)',
          fontSize: 10.5, fontWeight: 700,
          padding: '3px 6px', borderRadius: 'var(--r-6)',
          display: 'inline-flex', alignItems: 'center', gap: 2,
          color: 'var(--semo-fg-1)',
        }}>
          <Icon name="star-fill" size={10} color="var(--semo-warning)"/>
          <span className="semo-num">{rating.toFixed(1)}</span>
        </span>
      </div>
      <div style={{ padding: 14, display: 'grid', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>{agent.role}</div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2,
        }}>
          <span className="semo-num" style={{ fontSize: 11, color: 'var(--semo-fg-3)' }}>
            {employers}명 함께 중
          </span>
          <Badge tone="primary">Starter</Badge>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 * Plan — persona-aware (only copy changes)
 * ══════════════════════════════════════════════════════════════════ */
function PersonaPlan({ persona }) {
  return (
    <PersonaScope persona={persona}>
      <PersonaPlanInner/>
    </PersonaScope>
  );
}

function PersonaPlanInner() {
  const p = usePersona();
  const tiers = [
    { id: 'free',     name: 'Free',     price: 0,      bullets: ['동시 1명',  '월 300건',  '50MB'] },
    { id: 'starter',  name: 'Starter',  price: 29000,  bullets: ['동시 3명',  '월 5,000건', '500MB'], current: true },
    { id: 'pro',      name: 'Pro',      price: 79000,  bullets: ['동시 7명',  '월 25,000건', '5GB'], recommended: true },
    { id: 'business', name: 'Business', price: 199000, bullets: ['제한 없음', '제한 없음',   '50GB'] },
  ];
  return (
    <AppShell mode="customer" active="plan"
              workspace={p.workspace.name}
              title="요금제" subtitle="Starter · 다음 결제일 6월 28일">
      <div style={{ height: '100%', overflow: 'hidden', padding: '28px 32px',
                    display: 'grid', gap: 22, alignContent: 'start' }}>
        <Card padding={24} accent>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Eyebrow>Current Plan</Eyebrow>
                <Badge tone="cream">
                  <Icon name={p.icon} size={11} stroke={2}/>&nbsp;{p.label}
                </Badge>
              </div>
              <h2 style={{
                margin: '6px 0 4px', fontSize: 30, fontWeight: 700,
                color: 'var(--semo-fg-1)', letterSpacing: '-0.02em',
              }}>Starter <span style={{ color: 'var(--semo-fg-3)', fontWeight: 500, fontSize: 18 }}>
                · 월 ₩29,000</span></h2>
              <div style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>
                {p.plan.audience} · 다음 결제: 6월 28일
              </div>
            </div>
            <Button variant="primary" iconRight="arrow-right">Pro 로 업그레이드</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 18, marginTop: 22 }}>
            <Progress label={p.home.planLabel}     sub="1,240 / 5,000" value={1240} max={5000}/>
            <Progress label="가게/노트 용량"        sub="124 / 500MB"   value={124}  max={500}/>
            <Progress label="동시 채용한 직원"      sub="3 / 3명"        value={3}    max={3} warning/>
          </div>
        </Card>

        <Section eyebrow="Compare" title="플랜 비교"
                 hint={p.plan.tip}
                 action={<SegTab value="monthly" options={[
                   { value: 'monthly', label: '월간' },
                   { value: 'yearly',  label: '연간 -20%' },
                 ]}/>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {tiers.map(t => (
              <div key={t.id} style={{
                background: t.current ? 'var(--semo-cream)' :
                            t.recommended ? 'var(--semo-primary-08)' :
                            'var(--semo-surface)',
                border: `1.5px solid ${t.current ? 'var(--semo-primary)' :
                                       t.recommended ? 'var(--semo-ai-16)' :
                                       'var(--semo-line)'}`,
                borderRadius: 'var(--r-14)',
                padding: 18,
                display: 'grid', gap: 12,
                position: 'relative',
                boxShadow: t.current ? '0 0 0 3px var(--semo-primary-08)' : 'none',
              }}>
                {t.recommended && (
                  <span style={{
                    position: 'absolute', top: -10, right: 18,
                    fontSize: 10.5, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 'var(--r-full)',
                    background: 'var(--semo-ai)', color: '#fff',
                  }}>가장 인기</span>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{t.name}</span>
                  {t.current && <Badge tone="primary">현재</Badge>}
                </div>
                <span className="semo-num" style={{
                  fontSize: 26, fontWeight: 700, color: 'var(--semo-fg-1)', letterSpacing: '-0.02em',
                }}>{t.price === 0 ? '무료' : `₩${t.price.toLocaleString()}`}</span>
                <div style={{ display: 'grid', gap: 6, fontSize: 13,
                              paddingTop: 10, borderTop: '1px solid var(--semo-line-soft)' }}>
                  {t.bullets.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6,
                                          color: 'var(--semo-fg-2)' }}>
                      <Icon name="check" size={12} color="var(--semo-success)" stroke={2.5}/>
                      {b}
                    </div>
                  ))}
                </div>
                <Button variant={t.recommended ? 'ai' : 'secondary'} full size="md">
                  {t.current ? '현재 플랜' : '이 플랜으로 변경'}
                </Button>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

export { PersonaScope, PersonaHome, PersonaLibrary, PersonaPlan };
