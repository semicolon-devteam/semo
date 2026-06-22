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
 * SemiColony: every bot, every KB entry, every nudge, every plan signal,
 * linked together in one scrollable canvas.
 */

function ScreenHome({ agents, activity, stats, nudges, demo = false, personaVM }) {
  // persona 표현(카피)만 viewmodel 에서 — 실데이터(agents/activity/stats)는 그대로.
  const vmHome = personaVM?.home ?? {};
  const cp = {
    eyebrow: vmHome.eyebrow ?? 'Today · 오전 9:47',
    greetingTitle: vmHome.greetingTitle ?? '안녕하세요 정민 사장님.',
    greetingSubtitle: vmHome.greetingSubtitle ?? '오늘 에이전트들이 이런 일을 했어요.',
    feedTitle: vmHome.feedTitle ?? '활동 피드',
    nudgeTitle: vmHome.nudgeTitle ?? '승인이 필요한 일',
    workingTitle: vmHome.workingTitle ?? '지금 일하는 에이전트',
    weekKB: vmHome.weekKB ?? '이번 주 Colony 지식도서관',
  };
  const jumuni = AGENT_BY_ID['jumuni'];
  const dangol = AGENT_BY_ID['dangol-i'];
  const hwegye = AGENT_BY_ID['hwegyedo-ri'];
  const algorim = AGENT_BY_ID['algorim-i'];
  const chaewo = AGENT_BY_ID['chae-wo'];
  const semi   = AGENT_BY_ID['sem-i'];
  const biseo  = AGENT_BY_ID['bi-seo'];

  // 신규 가입자(실 테넌트, 에이전트 0) → 남의 가게 mock 대신 빈 상태. 데모는 시드가 있어 해당 없음.
  if (!demo && (!agents || agents.length === 0)) {
    return (
      <AppShell mode="customer" active="home" title="홈" subtitle="환영합니다" onModeToggle={null}>
        <EmptyState
          icon="users"
          title="아직 에이전트가 없어요"
          sub="첫 에이전트 팀을 켜면 오늘 한 일·승인 대기·지식도서관 업데이트가 여기 모여요."
          ctaLabel="첫 에이전트 켜기"
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
                label="오늘 문의 응대"
                value={stats ? `${stats.todayResponses}건` : '14건'}
                delta={+12}
                hint={hasWorking ? `${working.map((a) => a.name).slice(0, 2).join(' · ')}` : '토키 · 다람'}
                ai
                chart={<MiniBarChart data={[3, 5, 4, 8, 9, 12, 14]} width={140} height={32}/>}
              />
              <StatCardWithChart
                label="견적 초안"
                value="6건"
                delta={+8}
                hint="견적이가 준비"
                ai
                chart={<MiniLineChart data={[1, 2, 2, 3, 4, 6]} width={140} height={32}/>}
              />
              <StatCardWithChart
                label="새 지식도서관 노드"
                value={stats ? `${stats.newKnowledge}건` : '8건'}
                delta={null}
                hint="Colony가 정리"
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
                  { value: 'ai',     label: '에이전트가 한 일' },
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
                    verb="새 문의를 받고 1차 문진을 마쳤어요"
                    target="영등포 싱크대 상판 보수"
                    detail="사진 3장, 희망 일정, 예산 범위를 확인했고 콜백 후보 시간을 잡아뒀어요."
                    time="2분 전"
                    status="working"
                  />
                  <ActivityFeedItem
                    agent={dangol}
                    verb="이전 고객 맥락을 찾아냈어요"
                    target="지난 욕실 실리콘 시공 고객"
                    detail="작년 11월 방문, 빠른 답변 선호, 문자보다 전화 응답률이 높았어요."
                    time="8분 전"
                  />
                </FeedGroup>

                <FeedGroup label="오전 9시 ~">
                  <ActivityFeedItem
                    agent={hwegye}
                    verb="이번 주 견적·입금 리포트를 만들었어요"
                    target="Colony 지식도서관에 저장"
                    detail="견적 6건, 확정 2건, 입금 확인 1건. 다음 주 화·목 저녁 문의 전환율이 높았어요."
                    time="9:32"
                  />
                  <ActivityFeedItem
                    agent={algorim}
                    verb="시공 후기 게시물 초안을 만들었어요"
                    target="'상가 바닥 보수 전후'"
                    detail="전후 사진 4장, 고객 후기 1개, 블로그용 문단과 인스타 문구를 나눠뒀어요."
                    time="9:14"
                  />
                  <ActivityFeedItem
                    agent={chaewo}
                    verb="내일 방문 체크리스트를 만들었어요"
                    target="마포 욕실 코킹 재시공"
                    detail="실리콘, 커터, 보양테이프, 고객 주차 안내까지 준비 항목으로 묶었어요."
                    time="8:47"
                  />
                </FeedGroup>

                <FeedGroup label="어제" last>
                  <ActivityFeedItem
                    agent={semi}
                    verb="견적 기준을 업데이트했어요"
                    target="'야간 긴급 방문은 최소 출장비 별도'"
                    detail="어제 승인한 응대 기준을 운영 프로필에 반영할지 확인 대기 중이에요."
                    time="어제 18:00"
                  />
                  <ActivityFeedItem
                    agent={biseo}
                    verb="현장 방문 일정을 정리했어요"
                    target="6월 3일 14:00"
                    detail="장소, 주차, 고객 요청사항을 캘린더와 지식도서관에 함께 저장했어요."
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
                    title="토키가 문의 답변 승인을 요청했어요"
                    detail="영등포 싱크대 상판 보수 문의에 1차 답변을 보낼까요? 예상 먹이 5개."
                    primary="승인하고 발송"
                    secondary="내가 답하기"
                  />
                  <NudgeItem
                    agent={semi}
                    title="견적이가 견적 범위 확인을 요청했어요"
                    detail="사진 기준 18만~28만 원 안내 초안입니다. 발송 전 사장님 승인이 필요해요. 예상 먹이 10개."
                    primary="견적 초안 보기"
                    secondary="수정 요청"
                  />
                  <NudgeItem
                    agent={algorim}
                    title="키키가 후기 게시 승인을 기다려요"
                    detail="고객 동의 문구와 전후 사진 4장을 채널별 포맷으로 정리했어요. 예상 먹이 12개."
                    primary="미리보기"
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
                  <WorkingRow agent={jumuni} task="새 문의 문진 중" detail="3개 대화"/>
                  <WorkingRow agent={semi} task="견적 초안 작성 중" detail="62%" progress={62}/>
                  <WorkingRow agent={algorim} task="후기·사진 정리 중" detail="대기"/>
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
              label="이번 달 먹이"
              sub="240 / 800 먹이"
              value={240} max={800}/>
            <div style={{
              fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 10, lineHeight: 1.5,
            }}>
              이번 달 먹이 30% 사용 중. Taste 플랜 · 매월 1일 충전.
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
