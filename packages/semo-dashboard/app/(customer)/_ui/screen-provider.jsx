'use client';
import React from 'react';
import { AGENT_BY_ID, BotAvatar } from './agents';
import { Icon, Card, Badge, Button, SegTab, AppShell, MiniBarChart } from './components';

/*
 * screen-provider.jsx — Provider Agent Factory & Curation (§4.5).
 *
 * Two tabs:
 *  - My Agents (Semicolon-published presets) — performance table
 *  - 검수 대기 (user-submitted bots awaiting review) — review queue
 *
 * Higher information density than customer screens, but same DS.
 */

function ScreenProvider({ tab: initialTab = 'review' }) {
  const [tab, setTab] = React.useState(initialTab);
  return (
    <AppShell mode="provider" active="factory" title="라이브러리 운영"
              subtitle={tab === 'review' ? '검수 대기 12건' : '내 프리셋 24개'}
              onModeToggle={() => {}}>
      <div style={{
        height: '100%', overflow: 'hidden',
        display: 'grid', gridTemplateRows: 'auto 1fr',
      }}>
        {/* Tabs + actions row */}
        <div style={{
          padding: '20px 28px 0',
          borderBottom: '1px solid var(--semo-line)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, position: 'relative', height: 44 }}>
              {[
                { id: 'mine',   label: 'My Agents',   sub: '24' },
                { id: 'review', label: '검수 대기',     sub: '12', urgent: true },
                { id: 'pub',    label: '게시 예정',     sub: '3' },
                { id: 'arch',   label: '아카이브',     sub: null },
              ].map(t => {
                const sel = t.id === tab;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    height: 44, position: 'relative',
                    fontSize: 14, fontWeight: 600,
                    color: sel ? 'var(--semo-fg-1)' : 'var(--semo-fg-3)',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    {t.label}
                    {t.sub && <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '1px 6px', borderRadius: 'var(--r-full)',
                      background: t.urgent ? 'var(--semo-danger-bg)' : 'var(--semo-surface-3)',
                      color: t.urgent ? 'var(--semo-danger)' : 'var(--semo-fg-3)',
                    }} className="semo-num">{t.sub}</span>}
                    {sel && <div style={{
                      position: 'absolute', bottom: -1, left: 0, right: 0,
                      height: 2, background: 'var(--semo-fg-1)',
                    }}/>}
                  </button>
                );
              })}
            </div>
            <Button variant="primary" icon="plus">새 프리셋</Button>
          </div>
        </div>

        {tab === 'review' ? <ReviewQueue/> : <MyAgentsTable/>}
      </div>
    </AppShell>
  );
}

/* ── Review queue (검수 대기) ─────────────────────────────────────── */
function ReviewQueue() {
  const queue = [
    { id: 'r1', name: '예약지기 v2', submitter: '카페 미루', dept: '예약·CS',
      desc: '예약 노쇼율을 줄이는 응대 봇. 자동 리마인드 + 단골 예약 인식.',
      color: 'var(--agent-rose)', accent: '#C66095', accessoryKind: 'clock',
      safety: 92, quality: 88, dup: 12,
      flags: ['중복 의심'], time: '12분 전', selected: true },
    { id: 'r2', name: '리뷰지기',    submitter: '미용실 헤어홈', dept: 'CS',
      desc: '네이버 리뷰에 답글 초안을 만들어줘요.',
      color: 'var(--agent-butter)', accent: '#B27418', accessoryKind: 'heart',
      safety: 96, quality: 90, dup: 4,
      flags: [], time: '34분 전' },
    { id: 'r3', name: '공구이',      submitter: '쇼핑몰 단지',   dept: '주문',
      desc: '공동구매 진행 상황을 자동으로 알려줘요.',
      color: 'var(--agent-coral)', accent: '#D9543F', accessoryKind: 'box',
      safety: 78, quality: 72, dup: 6,
      flags: ['안전 검사 주의'], time: '1시간 전' },
    { id: 'r4', name: '꽃집비서',    submitter: '꽃집 마조',     dept: 'CS',
      desc: '꽃다발 주문 응대 + 배송지 검증.',
      color: 'var(--agent-rose)', accent: '#C66095', accessoryKind: 'heart',
      safety: 94, quality: 86, dup: 2,
      flags: [], time: '2시간 전' },
    { id: 'r5', name: '학원지기',    submitter: '코딩학원 점프',  dept: '예약',
      desc: '학원 수강생 출결을 관리해줘요.',
      color: 'var(--agent-lavender)', accent: '#6E5BD1', accessoryKind: 'calc',
      safety: 88, quality: 82, dup: 0,
      flags: [], time: '3시간 전' },
  ];
  const sel = queue.find(q => q.selected) || queue[0];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '360px 1fr',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Queue list */}
      <div style={{
        borderRight: '1px solid var(--semo-line)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--semo-line-soft)',
          background: 'var(--semo-bg-soft)',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <SegTab value="new" options={[
              { value: 'new',  label: '새로 접수' },
              { value: 'mine', label: '나에게 할당' },
              { value: 'all',  label: '전체' },
            ]}/>
          </div>
          <button style={{
            color: 'var(--semo-fg-3)',
            padding: 6,
          }}><Icon name="filter" size={15}/></button>
        </div>
        {queue.map((q) => (
          <ReviewRow key={q.id} q={q}/>
        ))}
      </div>

      {/* Detail */}
      <ReviewDetail q={sel}/>
    </div>
  );
}

function ReviewRow({ q }) {
  return (
    <div style={{
      padding: '14px 18px',
      borderBottom: '1px solid var(--semo-line-soft)',
      background: q.selected ? 'var(--semo-cream)' : 'transparent',
      borderLeft: q.selected ? '3px solid var(--semo-primary)' : '3px solid transparent',
      display: 'flex', gap: 12,
    }}>
      <BotAvatar agent={q} size={40}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{q.name}</span>
          <span className="semo-num" style={{ fontSize: 11, color: 'var(--semo-fg-muted)' }}>{q.time}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>
          @{q.submitter} · {q.dept}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--semo-fg-2)', marginTop: 6, lineHeight: 1.45,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {q.desc}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
          <ScoreChip label="안전" v={q.safety}/>
          <ScoreChip label="품질" v={q.quality}/>
          <ScoreChip label="중복" v={q.dup} inverted/>
          {q.flags.map(f => (
            <Badge key={f} tone="warning">{f}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreChip({ label, v, inverted }) {
  const tone = inverted
    ? (v <= 5 ? 'success' : v <= 15 ? 'warning' : 'danger')
    : (v >= 90 ? 'success' : v >= 80 ? 'warning' : 'danger');
  return (
    <Badge tone={tone}>
      {label} <span className="semo-num">{v}</span>
    </Badge>
  );
}

function ReviewDetail({ q }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 320px',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Center column */}
      <div style={{ padding: '22px 28px', overflow: 'hidden', display: 'grid', gap: 20, alignContent: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            padding: 12,
            background: 'var(--semo-surface)',
            borderRadius: 'var(--r-14)',
            border: '1px solid var(--semo-line)',
          }}>
            <BotAvatar agent={q} size={68}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{q.name}</div>
            <div style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>
              @{q.submitter} 가 제출 · {q.time}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Badge tone="cream">{q.dept}</Badge>
              {q.flags.map(f => (
                <Badge key={f} tone="warning">{f}</Badge>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon="x">반려</Button>
            <Button variant="cream">수정 요청</Button>
            <Button variant="primary" icon="check">승인 & 게시</Button>
          </div>
        </div>

        {/* Definition / code preview */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--semo-line-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--semo-surface-2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="book" size={14} color="var(--semo-fg-3)"/>
              <span style={{ fontSize: 13, color: 'var(--semo-fg-2)', fontWeight: 600 }}>제출된 정의서</span>
              <Badge tone="neutral">agent.yaml</Badge>
            </div>
            <button style={{ color: 'var(--semo-fg-3)' }}>
              <Icon name="external" size={14}/>
            </button>
          </div>
          <pre style={{
            margin: 0, padding: '14px 16px',
            fontFamily: 'var(--semo-mono)',
            fontSize: 12.5, lineHeight: 1.65,
            color: 'var(--semo-fg-2)',
            background: 'var(--semo-surface)',
            overflow: 'hidden',
          }}>
{`name: 예약지기 v2
role: "예약·노쇼 관리 직원"
persona:
  greeting: "안녕하세요! 예약을 도와드릴게요."
  tone: 친근하고 정중하게
skills:
  - calendar.book
  - calendar.cancel
  - sms.send_reminder
  - customer.recognize
permissions:
  - 카카오톡 비즈니스
  - Google Calendar
guardrails:
  - "예약 변경은 사장님 확인 필수"
  - "중복 예약 시 항상 알림"`}
          </pre>
        </Card>

        {/* Diff vs existing */}
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Icon name="git" size={14} color="var(--semo-warning)"/>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
              기존 ‘예약지기’ 와 비교
            </span>
            <Badge tone="warning">중복 의심 12%</Badge>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            fontSize: 13,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--semo-fg-3)', marginBottom: 6, fontWeight: 600 }}>
                기존 예약지기
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--semo-fg-2)', lineHeight: 1.6 }}>
                <li>카카오톡으로 예약 받기</li>
                <li>예약 1일 전 리마인드 1회</li>
              </ul>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--semo-fg-3)', marginBottom: 6, fontWeight: 600 }}>
                새 제출 (v2)
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--semo-fg-2)', lineHeight: 1.6 }}>
                <li>카카오톡으로 예약 받기</li>
                <li style={{ background: 'var(--semo-success-bg)', padding: '0 4px', borderRadius: 4 }}>
                  단골 예약 인식 + 우선 처리 (신규)
                </li>
                <li style={{ background: 'var(--semo-success-bg)', padding: '0 4px', borderRadius: 4 }}>
                  노쇼 패턴 학습 (신규)
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Right: auto-checks + comments */}
      <aside style={{
        borderLeft: '1px solid var(--semo-line)',
        background: 'var(--semo-bg-soft)',
        padding: '22px 18px',
        display: 'grid', gap: 18,
        alignContent: 'start',
        overflow: 'hidden',
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
          }}>자동 검사</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <CheckRow label="안전 검사 (프롬프트 인젝션, 개인정보)" pass score="92"/>
            <CheckRow label="응답 품질 (단위 테스트 통과율)"          pass score="88"/>
            <CheckRow label="중복 검사 (벡터 유사도)"                warn score="12% 유사" warnText/>
            <CheckRow label="권한 범위 (최소 권한 원칙)"               pass score="OK"/>
            <CheckRow label="페르소나 일관성"                          pass score="9/10"/>
          </div>
        </div>

        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
          }}>운영팀 메모</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ReviewComment name="garden" time="4분 전"
              text="기존 예약지기와 충돌 우려. 노쇼 학습은 좋은 아이디어 — 별도 봇으로 분리하면 어떨까?"/>
            <ReviewComment name="kyago" time="방금 전"
              text="동의. 단골 인식만 기존 예약지기에 머지하는 게 깔끔할 것 같아."/>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <input placeholder="메모 추가…" style={{
              flex: 1, padding: '8px 10px', fontSize: 13,
              background: 'var(--semo-surface)',
              border: '1px solid var(--semo-line)',
              borderRadius: 'var(--r-8)', outline: 'none',
            }}/>
            <Button size="sm" variant="secondary">남기기</Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CheckRow({ label, score, pass, warn, warnText }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px',
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-8)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: pass ? 'var(--semo-success-bg)' :
                    warn ? 'var(--semo-warning-bg)' : 'var(--semo-danger-bg)',
        color:      pass ? 'var(--semo-success)' :
                    warn ? 'var(--semo-warning)' : 'var(--semo-danger)',
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <Icon name={pass ? 'check' : 'warn'} size={12} stroke={2.5}/>
      </div>
      <div style={{ flex: 1, fontSize: 12.5, color: 'var(--semo-fg-2)' }}>{label}</div>
      <span className="semo-num" style={{
        fontSize: 11.5, color: warnText ? 'var(--semo-warning)' : 'var(--semo-fg-3)',
        fontWeight: 600,
      }}>{score}</span>
    </div>
  );
}

function ReviewComment({ name, time, text }) {
  return (
    <div style={{
      padding: 10,
      background: 'var(--semo-surface)',
      border: '1px solid var(--semo-line)',
      borderRadius: 'var(--r-10)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--semo-fg-1)' }}>@{name}</span>
        <span style={{ fontSize: 11, color: 'var(--semo-fg-muted)' }}>{time}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--semo-fg-2)', marginTop: 4, lineHeight: 1.5 }}>
        {text}
      </div>
    </div>
  );
}

/* ── My Agents tab (preset performance) ───────────────────────────── */
function MyAgentsTable() {
  const rows = [
    { agent: AGENT_BY_ID['jumuni'],     hires: 1284, rating: 4.8, issues: 3,  trend: [12, 18, 22, 28, 36, 42, 48] },
    { agent: AGENT_BY_ID['hwegyedo-ri'], hires: 942, rating: 4.9, issues: 0,  trend: [8, 12, 14, 16, 20, 22, 24] },
    { agent: AGENT_BY_ID['algorim-i'],   hires: 768, rating: 4.6, issues: 8,  trend: [10, 11, 14, 16, 18, 20, 22] },
    { agent: AGENT_BY_ID['sem-i'],       hires: 612, rating: 4.7, issues: 1,  trend: [6, 8, 10, 14, 16, 18, 20] },
    { agent: AGENT_BY_ID['chae-wo'],     hires: 521, rating: 4.7, issues: 2,  trend: [5, 7, 9, 10, 12, 14, 16] },
    { agent: AGENT_BY_ID['dangol-i'],    hires: 487, rating: 4.8, issues: 0,  trend: [4, 6, 8, 10, 12, 14, 16] },
    { agent: AGENT_BY_ID['bi-seo'],      hires: 312, rating: 4.9, issues: 1,  trend: [3, 5, 7, 8, 10, 12, 14] },
  ];
  return (
    <div style={{ padding: '20px 28px', overflow: 'hidden' }}>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 200px 100px 80px 100px 160px 80px 40px',
          gap: 16, padding: '12px 18px',
          fontSize: 11, fontWeight: 600, color: 'var(--semo-fg-3)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'var(--semo-bg-soft)',
          borderBottom: '1px solid var(--semo-line)',
        }}>
          <span></span>
          <span>이름</span>
          <span style={{ textAlign: 'right' }}>채용 중</span>
          <span style={{ textAlign: 'right' }}>평점</span>
          <span style={{ textAlign: 'right' }}>리포트</span>
          <span>7주 추세</span>
          <span style={{ textAlign: 'right' }}>플랜</span>
          <span></span>
        </div>
        {rows.map((r, i) => (
          <div key={r.agent.id} style={{
            display: 'grid',
            gridTemplateColumns: '40px 200px 100px 80px 100px 160px 80px 40px',
            gap: 16, padding: '12px 18px',
            alignItems: 'center',
            borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--semo-line-soft)',
          }}>
            <BotAvatar agent={r.agent} size={32}/>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--semo-fg-1)' }}>{r.agent.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--semo-fg-3)' }}>{r.agent.role}</div>
            </div>
            <span className="semo-num" style={{ fontSize: 13, fontWeight: 600,
                                                color: 'var(--semo-fg-1)', textAlign: 'right' }}>
              {r.hires.toLocaleString()}
            </span>
            <span className="semo-num" style={{ fontSize: 13, fontWeight: 600,
                                                color: 'var(--semo-fg-1)', textAlign: 'right',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
              <Icon name="star-fill" size={11} color="var(--semo-warning)"/>{r.rating}
            </span>
            <span style={{ textAlign: 'right' }}>
              {r.issues > 0 ?
                <Badge tone={r.issues > 5 ? 'danger' : 'warning'}>{r.issues}건</Badge> :
                <Badge tone="success" icon="check">없음</Badge>}
            </span>
            <MiniBarChart data={r.trend} width={150} height={24}/>
            <span style={{ textAlign: 'right' }}>
              <Badge tone={r.agent.priceTier === 'Starter' ? 'primary' :
                          r.agent.priceTier === 'Pro' ? 'ai' : 'warning'}>{r.agent.priceTier}</Badge>
            </span>
            <button style={{ color: 'var(--semo-fg-3)' }}>
              <Icon name="more" size={16}/>
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}

export { ScreenProvider };
