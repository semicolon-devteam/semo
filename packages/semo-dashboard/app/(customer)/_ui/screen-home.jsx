'use client';
import { AGENT_BY_ID, BotAvatar } from './agents';
import {
  AppShell, Eyebrow, Card, Badge, SegTab, Icon,
  MiniBarChart, MiniLineChart, Progress, ActivityFeedItem, NudgeItem, EmptyState,
} from './components';

/*
 * screen-home.jsx — Customer Home (§4.6, THE main page).
 *
 * The brief's promise: "메인페이지는 Pasted text 요소들을 모아서 요약해
 * 보여주는 대시보드" — so this screen IS the summary of everything in
 * SEMO: every bot, every KB entry, every nudge, every plan signal,
 * linked together in one scrollable canvas.
 */

function ScreenHome({ agents, activity, stats, nudges, demo = false, personaVM }) {
  // persona 표현(카피)만 viewmodel 에서 — 실데이터(agents/activity/stats)는 그대로.
  const vmHome = personaVM?.home ?? {};
  const cp = {
    eyebrow: vmHome.eyebrow ?? 'Today · 오전 9:47',
    greetingTitle: vmHome.greetingTitle ?? '안녕하세요 정민 사장님.',
    greetingSubtitle: vmHome.greetingSubtitle ?? '오늘 직원들이 이런 일을 했어요.',
    feedTitle: vmHome.feedTitle ?? '활동 피드',
    nudgeTitle: vmHome.nudgeTitle ?? '오늘 사장님이 해주셔야 할 일',
    workingTitle: vmHome.workingTitle ?? '지금 일하고 있어요',
    weekKB: vmHome.weekKB ?? '이번 주 가게 지식',
  };
  const jumuni = AGENT_BY_ID['jumuni'];
  const dangol = AGENT_BY_ID['dangol-i'];
  const hwegye = AGENT_BY_ID['hwegyedo-ri'];
  const algorim = AGENT_BY_ID['algorim-i'];
  const chaewo = AGENT_BY_ID['chae-wo'];
  const semi   = AGENT_BY_ID['sem-i'];
  const biseo  = AGENT_BY_ID['bi-seo'];

  // 신규 가입자(실 테넌트, 직원 0) → 남의 가게 mock 대신 빈 상태. 데모는 시드가 있어 해당 없음.
  if (!demo && (!agents || agents.length === 0)) {
    return (
      <AppShell mode="customer" active="home" title="홈" subtitle="환영합니다" onModeToggle={null}>
        <EmptyState
          icon="users"
          title="아직 직원이 없어요"
          sub="첫 AI 직원을 채용하면 오늘 한 일·가게 지식·매출 인사이트가 여기 모여요."
          ctaLabel="첫 직원 채용하기"
          ctaTo="/library"
        />
      </AppShell>
    );
  }

  // 실데이터(있으면) → 화면 구동, 없으면 디자인 mock 폴백.
  const hasActivity = activity && activity.length > 0;
  const working = (agents || []).filter((a) => a.state === 'working');
  const hasWorking = working.length > 0;
  const hasNudges = nudges && nudges.length > 0;

  // 활동 피드를 버킷 순서로 그룹화 (실데이터 경로).
  const BUCKET_ORDER = ['방금 전', '오늘', '어제'];
  const grouped = BUCKET_ORDER
    .map((b) => ({ label: b, items: (activity || []).filter((it) => it.bucket === b) }))
    .filter((g) => g.items.length > 0);

  return (
    <AppShell
      mode="customer"
      active="home"
      title="홈"
      subtitle="화요일 · 5월 28일"
      onModeToggle={null}>
      <div style={{
        height: '100%',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 0,
      }}>
        {/* ── Left main column ────────────────────────────────────── */}
        <div style={{
          padding: '28px 32px 40px',
          display: 'grid', gap: 24,
          alignContent: 'start',
          overflow: 'hidden',
        }}>
          {/* Greeting + 3 stats */}
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <Eyebrow>{cp.eyebrow}</Eyebrow>
              <h1 style={{
                margin: '8px 0 0',
                fontSize: 'var(--t-display)',
                lineHeight: 1.12,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--semo-fg-1)',
              }}>
                {cp.greetingTitle}<br/>
                <span style={{ color: 'var(--semo-fg-3)', fontWeight: 600 }}>
                  {cp.greetingSubtitle}
                </span>
              </h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCardWithChart
                label="오늘 응대"
                value={stats ? `${stats.todayResponses}건` : '36건'}
                delta={+12}
                hint={hasWorking ? `${working.map((a) => a.name).slice(0, 2).join(' · ')}` : '주문이 · 단골이'}
                ai
                chart={<MiniBarChart data={[14, 18, 12, 22, 19, 28, 36]} width={140} height={32}/>}
              />
              <StatCardWithChart
                label="어제 매출"
                value="₩412,000"
                delta={+8}
                hint="셈이가 분석함"
                ai
                chart={<MiniLineChart data={[320, 280, 360, 410, 340, 412]} width={140} height={32}/>}
              />
              <StatCardWithChart
                label="새 가게 지식"
                value={stats ? `${stats.newKnowledge}건` : '8건'}
                delta={null}
                hint="3명이 함께 채움"
                ai
                chart={<KBSpark/>}
              />
            </div>
          </div>

          {/* Activity feed */}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--semo-line-soft)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="inbox" size={18} color="var(--semo-fg-2)"/>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
                  {cp.feedTitle}
                </h3>
                <Badge tone="primary">{hasActivity ? activity.length : 36}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <SegTab value="all" options={[
                  { value: 'all',    label: '전체' },
                  { value: 'ai',     label: 'AI 가 한 일' },
                  { value: 'wait',   label: '내 결정 대기' },
                ]}/>
              </div>
            </div>

            {hasActivity ? (
              grouped.map((g, gi) => (
                <FeedGroup key={g.label} label={g.label} last={gi === grouped.length - 1}>
                  {g.items.map((it) => (
                    <ActivityFeedItem
                      key={it.id}
                      agent={it.agent || jumuni}
                      verb={it.verb}
                      target={it.target}
                      detail={it.detail}
                      time={it.timeAgo}
                      status={it.status}
                    />
                  ))}
                </FeedGroup>
              ))
            ) : (
              <>
                <FeedGroup label="방금 전">
                  <ActivityFeedItem
                    agent={jumuni}
                    verb="카카오톡 문의에 답했어요"
                    target="단골 김미영 님"
                    detail="시그니처 메뉴 '더치 라떼' 추천 + 단골 할인 안내. 답변 만족도 ★★★★★"
                    time="2분 전"
                    status="working"
                  />
                  <ActivityFeedItem
                    agent={dangol}
                    verb="단골 손님을 알아봤어요"
                    target="이번 달 5번째 방문"
                    detail="박지호 님이 오후 2시쯤 오실 예정. 평소 따뜻한 아메리카노 + 베이글."
                    time="8분 전"
                  />
                </FeedGroup>

                <FeedGroup label="오전 9시 ~">
                  <ActivityFeedItem
                    agent={hwegye}
                    verb="5월 4주차 매출 리포트를 만들었어요"
                    target="가게 지식에 저장"
                    detail="총 매출 ₩2,148,000 (+15%). 화요일 매출이 평균 대비 22% 높았어요."
                    time="9:32"
                  />
                  <ActivityFeedItem
                    agent={algorim}
                    verb="인스타 게시물 초안을 만들었어요"
                    target="'신메뉴 더치 라떼'"
                    detail="해시태그 7개 + 사진 3장 후보. 게시 전에 한 번 검토해주세요."
                    time="9:14"
                  />
                  <ActivityFeedItem
                    agent={chaewo}
                    verb="우유 재고 부족을 알렸어요"
                    target="발주 초안 준비됨"
                    detail="저지방 우유 2팩 남음 · 내일 오전 소진 예상. 평소 거래처에 자동 발주서 작성 완료."
                    time="8:47"
                  />
                </FeedGroup>

                <FeedGroup label="어제" last>
                  <ActivityFeedItem
                    agent={semi}
                    verb="어제의 인사이트를 만들었어요"
                    target="'오후 3-5시가 가장 한가해요'"
                    detail="이 시간대에 단골 할인 알림을 보내면 매출 +18% 효과 예상."
                    time="어제 18:00"
                  />
                  <ActivityFeedItem
                    agent={biseo}
                    verb="세무사 미팅 일정을 잡았어요"
                    target="6월 3일 14:00"
                    detail="장소: 강남구 역삼동 사무실. Google 캘린더에 추가됨."
                    time="어제 16:22"
                  />
                </FeedGroup>
              </>
            )}
          </Card>
        </div>

        {/* ── Right sidebar ───────────────────────────────────────── */}
        <aside style={{
          borderLeft: '1px solid var(--semo-line)',
          background: 'var(--semo-bg-soft)',
          padding: '28px 24px',
          display: 'grid', gap: 24,
          alignContent: 'start',
          overflow: 'hidden',
        }}>
          {/* Nudges */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="flag" size={16} color="var(--semo-warning)"/>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
                {cp.nudgeTitle}
              </h3>
              <Badge tone="warning">{hasNudges ? nudges.length : 3}</Badge>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {hasNudges ? (
                nudges.map((n) => (
                  <NudgeItem
                    key={n.id}
                    agent={n.agent || jumuni}
                    title={n.title}
                    detail={n.detail}
                    primary="승인하기"
                    secondary="내가 하기"
                  />
                ))
              ) : (
                <>
                  <NudgeItem
                    agent={jumuni}
                    title="단골 김미영 님 환불 요청"
                    detail="어제 케이크 상태가 이상하다고 하셨어요. 주문이가 답변 초안을 만들어뒀어요."
                    primary="승인하고 응대"
                    secondary="내가 답하기"
                  />
                  <NudgeItem
                    agent={algorim}
                    title="신메뉴 게시물 검토"
                    detail="알리미가 인스타용 초안 1개를 준비했어요."
                    primary="미리보기"
                    secondary="수정 요청"
                  />
                  <NudgeItem
                    agent={chaewo}
                    title="우유 발주 (저지방 2팩)"
                    detail="평소 거래처로 자동 발주 가능."
                    primary="발주하기"
                    secondary="나중에"
                  />
                </>
              )}
            </div>
          </div>

          {/* Working agents */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--semo-ai)',
                boxShadow: '0 0 0 4px var(--semo-ai-16)',
                animation: 'semo-pulse 1.8s ease-in-out infinite',
              }}/>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
                {cp.workingTitle}
              </h3>
            </div>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              {hasWorking ? (
                working.map((a) => (
                  <WorkingRow key={a.id} agent={a} task={a.todaySummary || a.role} detail="진행 중"/>
                ))
              ) : (
                <>
                  <WorkingRow agent={jumuni} task="카카오톡 응대 중" detail="3개 대화"/>
                  <WorkingRow agent={hwegye} task="오늘 매출 정산 중" detail="62%" progress={62}/>
                  <WorkingRow agent={algorim} task="SNS 모니터링 중" detail="대기"/>
                </>
              )}
            </Card>
          </div>

          {/* KB recap */}
          <Card padding={16}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--r-10)',
                background: 'var(--semo-primary-08)', color: 'var(--semo-primary)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <Icon name="network" size={18} stroke={2}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
                  {cp.weekKB}
                </div>
                <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 2 }}>
                  새 노드 8개 · 새 연결 23개
                </div>
              </div>
              <Icon name="chevron-right" size={16} color="var(--semo-fg-3)"/>
            </div>
            <div style={{ height: 64, marginTop: 12 }}>
              <KBPreview/>
            </div>
          </Card>

          {/* Plan signal */}
          <Card padding={16} accent>
            <Progress
              label="응대 사용량"
              sub="1,240 / 5,000"
              value={1240} max={5000}/>
            <div style={{
              fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 10, lineHeight: 1.5,
            }}>
              이번 달 한도 25% 사용 중. Starter 플랜 · 매월 1일 갱신.
            </div>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function StatCardWithChart({ label, value, delta, hint, ai, chart }) {
  const deltaTone = delta == null ? null : (delta >= 0 ? 'success' : 'danger');
  return (
    <Card padding={18}>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--semo-fg-3)', fontWeight: 500,
        }}>
          {ai && <span className="semo-ai-chip">AI</span>}
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div className="semo-num" style={{
            fontSize: 30, lineHeight: 1.1, fontWeight: 700,
            color: 'var(--semo-fg-1)', letterSpacing: '-0.02em',
          }}>{value}</div>
          {chart}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {deltaTone && (
            <Badge tone={deltaTone} icon={delta >= 0 ? 'up' : 'down'}>
              {delta >= 0 ? '+' : ''}{delta}%
            </Badge>
          )}
          {hint && <div style={{ fontSize: 12, color: 'var(--semo-fg-3)' }}>{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

function FeedGroup({ label, last, children }) {
  return (
    <div style={{
      borderBottom: last ? 'none' : '1px solid var(--semo-line-soft)',
      padding: '4px 6px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: 'var(--semo-fg-3)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '8px 14px 4px',
      }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function WorkingRow({ agent, task, detail, progress }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderBottom: '1px solid var(--semo-line-soft)',
    }}>
      <BotAvatar agent={agent} size={32} state="working"/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)' }}>{agent.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--semo-fg-3)' }}>{task}</div>
        {progress != null && (
          <div style={{
            height: 3, background: 'var(--semo-surface-3)',
            borderRadius: 'var(--r-full)', marginTop: 4, overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'var(--semo-ai)', borderRadius: 'var(--r-full)',
            }}/>
          </div>
        )}
      </div>
      <span className="semo-num" style={{
        fontSize: 11, color: 'var(--semo-ai)', fontWeight: 600,
      }}>{detail}</span>
    </div>
  );
}

function KBSpark() {
  // tiny abstract network for the "new KB" stat
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

function KBPreview() {
  // small static graph preview, blurred via opacity to suggest "more"
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
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.c}/>
      ))}
    </svg>
  );
}

export { ScreenHome };
