/*
 * agents.jsx — SemiColony agent personas + BotAvatar character component.
 *
 * Customer-facing workers use an animal-agent tone: warm, compact,
 * approachable characters with tiny role accessories. Semi and Colony are
 * product concepts; these are the visible working agents that ask, report,
 * and request approval in the owner's dashboard.
 *
 * Exports (to window): AGENTS, AGENT_BY_ID, BotAvatar, AvatarRing.
 */

const AGENTS = [
  {
    id: 'jumuni',
    name: '토키',
    species: '토끼',
    animalKind: 'rabbit',
    role: '응대 매니저',
    dept: '응대',
    color: 'var(--agent-peach)',
    accent: '#E07A3B',
    accessoryKind: 'headset',
    bio: '전화·채팅 문의를 먼저 받고, 필요한 문진과 콜백 예약까지 정리해요. 어려운 답변은 사장님께 승인 요청을 올려요.',
    skills: ['전화·채팅 응대', '문진', '콜백 예약'],
    integrations: ['자체 상담 채널', 'AI 전화', '카카오톡 예정'],
    feedPerTask: 5,
    weeklyFeed: 180,
    rating: 4.8,
    employers: 1284,
    priceTier: 'Taste',
  },
  {
    id: 'hwegyedo-ri',
    name: '부기',
    species: '부엉이',
    animalKind: 'owl',
    role: '재정·관리 매니저',
    dept: '재정',
    color: 'var(--agent-mint)',
    accent: '#2E9670',
    accessoryKind: 'calc',
    bio: '입금·세금계산서·주간 리포트를 챙기고, 반복되는 관리 업무를 지식도서관에 남겨요.',
    skills: ['입금 확인', '세금계산서', '주간 리포트'],
    integrations: ['홈택스', '계좌 내역', '스프레드시트'],
    feedPerTask: 8,
    weeklyFeed: 110,
    rating: 4.9,
    employers: 942,
    priceTier: 'Core',
  },
  {
    id: 'algorim-i',
    name: '키키',
    species: '여우',
    animalKind: 'fox',
    role: '후기·포트폴리오 매니저',
    dept: '콘텐츠',
    color: 'var(--agent-lavender)',
    accent: '#6E5BD1',
    accessoryKind: 'megaphone',
    bio: '시공 후 사진과 후기를 받아 포트폴리오 초안을 만들고, 채널별 게시 전 승인을 요청해요.',
    skills: ['후기 요청', '전후 사진 정리', '게시글 초안'],
    integrations: ['인스타그램', '네이버 블로그', '오늘의집'],
    feedPerTask: 12,
    weeklyFeed: 140,
    rating: 4.6,
    employers: 768,
    priceTier: 'Core',
  },
  {
    id: 'chae-wo',
    name: '포포',
    species: '수달',
    animalKind: 'otter',
    role: '운영·문서 매니저',
    dept: '운영',
    color: 'var(--agent-coral)',
    accent: '#D9543F',
    accessoryKind: 'box',
    bio: '준비물, 서류, 체크리스트를 챙기고 일정 전후로 놓치기 쉬운 업무를 정리해요.',
    skills: ['체크리스트', '문서 정리', '준비물 알림'],
    integrations: ['Google Drive', '스프레드시트', '캘린더'],
    feedPerTask: 6,
    weeklyFeed: 120,
    rating: 4.7,
    employers: 521,
    priceTier: 'Taste',
  },
  {
    id: 'sem-i',
    name: '견적이',
    species: '비버',
    animalKind: 'beaver',
    role: '견적·제안 매니저',
    dept: '견적',
    color: 'var(--agent-sky)',
    accent: '#1F7AC9',
    accessoryKind: 'chart',
    bio: '운영 프로필과 지난 견적을 바탕으로 넓은 범위의 견적 초안을 만들고, 발송 전 승인을 요청해요.',
    skills: ['견적 초안', '범위 안내', '제안서 정리'],
    integrations: ['견적 템플릿', 'PDF 내보내기', '지식도서관'],
    feedPerTask: 10,
    weeklyFeed: 160,
    rating: 4.7,
    employers: 612,
    priceTier: 'Taste',
  },
  {
    id: 'dangol-i',
    name: '다람',
    species: '다람쥐',
    animalKind: 'squirrel',
    role: '후속관리 매니저',
    dept: '후속관리',
    color: 'var(--agent-butter)',
    accent: '#B27418',
    accessoryKind: 'heart',
    bio: '시공 이후 불편함은 없었는지 묻고, 고객별 성향과 약속을 지식도서관에 정리해요.',
    skills: ['후속 연락', '고객 성향 기록', '재문의 관리'],
    integrations: ['문자', '자체 채팅', '카카오톡 예정'],
    feedPerTask: 5,
    weeklyFeed: 90,
    rating: 4.8,
    employers: 487,
    priceTier: 'Taste',
  },
  {
    id: 'bi-seo',
    name: '무무',
    species: '강아지',
    animalKind: 'dog',
    role: '일정·회의 비서',
    dept: '일정',
    color: 'var(--agent-rose)',
    accent: '#C66095',
    accessoryKind: 'clock',
    bio: '방문 일정과 미팅 메모를 정리하고, 음성 기록을 지식도서관으로 넘겨 다음 응대에 쓰이게 해요.',
    skills: ['일정 조율', '회의 메모', '리마인드'],
    integrations: ['Google Calendar', '음성 메모', '카카오톡 예정'],
    feedPerTask: 6,
    weeklyFeed: 100,
    rating: 4.9,
    employers: 312,
    priceTier: 'Core',
  },
];

const AGENT_BY_ID = Object.fromEntries(AGENTS.map(a => [a.id, a]));

/* ────────────────────────────────────────────────────────────────────
 * BotAvatar — a single SVG character.
 *
 * Anatomy (all driven from `size`):
 *   - Plate: round-rect "body" tinted with agent.color
 *   - Face: cream skin plate with eyes, cheeks, mouth
 *   - Accessory: tiny role icon on top of head
 *   - State: 'working' adds a soft pulse ring; 'resting' closes eyes;
 *            'error' tilts mouth + amber ring; 'idle' is the default.
 * ──────────────────────────────────────────────────────────────────── */
function BotAvatar({ agent, size = 80, state = 'idle', ring = false, talk = null }) {
  if (!agent) return null;
  const s = size;
  const eyeClosed = state === 'resting';
  const mouth =
    state === 'error'
      ? <path d={`M${s*0.40} ${s*0.66} Q${s*0.50} ${s*0.62} ${s*0.60} ${s*0.66}`}
              stroke="#1D242B" strokeWidth={Math.max(1.2, s*0.018)}
              strokeLinecap="round" fill="none"/>
      : state === 'resting'
      ? <path d={`M${s*0.42} ${s*0.66} L${s*0.58} ${s*0.66}`}
              stroke="#1D242B" strokeWidth={Math.max(1.2, s*0.018)}
              strokeLinecap="round" fill="none"/>
      : <path d={`M${s*0.40} ${s*0.63} Q${s*0.50} ${s*0.71} ${s*0.60} ${s*0.63}`}
              stroke="#1D242B" strokeWidth={Math.max(1.2, s*0.018)}
              strokeLinecap="round" fill="none"/>;

  return (
    <div style={{
      position: 'relative',
      width: s, height: s,
      display: 'inline-block',
      animation: state === 'working' ? 'semo-breathe 2.4s ease-in-out infinite' : 'none',
      borderRadius: '50%',
    }}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
        {/* outer ring on hover/selected */}
        {ring && (
          <circle cx={s/2} cy={s/2} r={s*0.49}
                  fill="none" stroke="var(--semo-primary)" strokeWidth={1.5}
                  strokeDasharray="3 3" />
        )}
        {renderAnimalBack(agent, s)}
        {/* body plate (rounded square tilted very slightly) */}
        <g transform={`translate(${s*0.5} ${s*0.55}) rotate(-3) translate(${-s*0.5} ${-s*0.55})`}>
          <rect
            x={s*0.10} y={s*0.20}
            width={s*0.80} height={s*0.72}
            rx={s*0.30} ry={s*0.32}
            fill={agent.color}
          />
          {/* darker rim at the bottom for tonal depth */}
          <rect
            x={s*0.10} y={s*0.74}
            width={s*0.80} height={s*0.18}
            rx={s*0.30} ry={s*0.32}
            fill={agent.accent} opacity="0.18"
          />
        </g>

        {/* face plate (cream) */}
        <ellipse
          cx={s*0.50} cy={s*0.56}
          rx={s*0.30} ry={s*0.26}
          fill="var(--agent-skin-1)"
        />

        {/* cheeks */}
        <ellipse cx={s*0.32} cy={s*0.62} rx={s*0.05} ry={s*0.035}
                 fill="var(--agent-cheek)" opacity="0.55"/>
        <ellipse cx={s*0.68} cy={s*0.62} rx={s*0.05} ry={s*0.035}
                 fill="var(--agent-cheek)" opacity="0.55"/>

        {/* eyes */}
        {eyeClosed ? (
          <>
            <path d={`M${s*0.36} ${s*0.54} Q${s*0.40} ${s*0.56} ${s*0.44} ${s*0.54}`}
                  stroke="#1D242B" strokeWidth={Math.max(1.2, s*0.020)}
                  strokeLinecap="round" fill="none"/>
            <path d={`M${s*0.56} ${s*0.54} Q${s*0.60} ${s*0.56} ${s*0.64} ${s*0.54}`}
                  stroke="#1D242B" strokeWidth={Math.max(1.2, s*0.020)}
                  strokeLinecap="round" fill="none"/>
          </>
        ) : (
          <>
            <ellipse cx={s*0.40} cy={s*0.54} rx={s*0.032} ry={s*0.045} fill="#1D242B"/>
            <ellipse cx={s*0.60} cy={s*0.54} rx={s*0.032} ry={s*0.045} fill="#1D242B"/>
            {/* eye highlight */}
            <ellipse cx={s*0.41} cy={s*0.525} rx={s*0.010} ry={s*0.012} fill="#FFFFFF"/>
            <ellipse cx={s*0.61} cy={s*0.525} rx={s*0.010} ry={s*0.012} fill="#FFFFFF"/>
          </>
        )}

        {mouth}

        {renderAnimalFaceDetails(agent, s)}

        {/* role accessory on top of head */}
        <g>{renderAccessory(agent, s)}</g>

        {/* state dot (working = violet, error = danger, resting = mute) */}
        {(state === 'working' || state === 'error') && (
          <circle
            cx={s*0.86} cy={s*0.86} r={s*0.085}
            fill={state === 'working' ? 'var(--semo-ai)' : 'var(--semo-danger)'}
            stroke="var(--semo-surface)" strokeWidth={Math.max(1.4, s*0.022)}
          />
        )}
      </svg>

      {/* speech bubble (optional) */}
      {talk && (
        <div style={{
          position: 'absolute',
          left: s + 6,
          top: -4,
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          borderRadius: 'var(--r-12)',
          borderBottomLeftRadius: 2,
          padding: '6px 10px',
          fontSize: 12,
          color: 'var(--semo-fg-2)',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--semo-shadow-1)',
        }}>{talk}</div>
      )}
    </div>
  );
}

function renderAnimalBack(agent, s) {
  const c = agent.color;
  const a = agent.accent;
  switch (agent.animalKind) {
    case 'rabbit':
      return (
        <g>
          <ellipse cx={s*0.38} cy={s*0.24} rx={s*0.075} ry={s*0.19}
                   fill={c} transform={`rotate(-16 ${s*0.38} ${s*0.24})`}/>
          <ellipse cx={s*0.62} cy={s*0.24} rx={s*0.075} ry={s*0.19}
                   fill={c} transform={`rotate(16 ${s*0.62} ${s*0.24})`}/>
          <ellipse cx={s*0.38} cy={s*0.25} rx={s*0.035} ry={s*0.12}
                   fill="var(--agent-skin-1)" opacity="0.72"
                   transform={`rotate(-16 ${s*0.38} ${s*0.25})`}/>
          <ellipse cx={s*0.62} cy={s*0.25} rx={s*0.035} ry={s*0.12}
                   fill="var(--agent-skin-1)" opacity="0.72"
                   transform={`rotate(16 ${s*0.62} ${s*0.25})`}/>
        </g>
      );
    case 'fox':
      return (
        <g>
          <path d={`M${s*0.22} ${s*0.41} L${s*0.34} ${s*0.18} L${s*0.44} ${s*0.42} Z`} fill={c}/>
          <path d={`M${s*0.56} ${s*0.42} L${s*0.66} ${s*0.18} L${s*0.78} ${s*0.41} Z`} fill={c}/>
          <path d={`M${s*0.28} ${s*0.37} L${s*0.34} ${s*0.25} L${s*0.39} ${s*0.39} Z`} fill="var(--agent-skin-1)" opacity="0.72"/>
          <path d={`M${s*0.61} ${s*0.39} L${s*0.66} ${s*0.25} L${s*0.72} ${s*0.37} Z`} fill="var(--agent-skin-1)" opacity="0.72"/>
          <path d={`M${s*0.82} ${s*0.62} C${s*1.02} ${s*0.54}, ${s*0.98} ${s*0.86}, ${s*0.78} ${s*0.82}`}
                stroke={a} strokeWidth={s*0.10} strokeLinecap="round" fill="none" opacity="0.35"/>
        </g>
      );
    case 'squirrel':
      return (
        <g>
          <circle cx={s*0.30} cy={s*0.34} r={s*0.075} fill={c}/>
          <circle cx={s*0.70} cy={s*0.34} r={s*0.075} fill={c}/>
          <path d={`M${s*0.82} ${s*0.68} C${s*1.02} ${s*0.42}, ${s*0.70} ${s*0.26}, ${s*0.76} ${s*0.55}
                   C${s*0.80} ${s*0.74}, ${s*0.94} ${s*0.82}, ${s*0.82} ${s*0.90}`}
                stroke={a} strokeWidth={s*0.10} strokeLinecap="round" fill="none" opacity="0.38"/>
        </g>
      );
    case 'owl':
      return (
        <g>
          <path d={`M${s*0.32} ${s*0.36} L${s*0.40} ${s*0.20} L${s*0.48} ${s*0.38} Z`} fill={c}/>
          <path d={`M${s*0.52} ${s*0.38} L${s*0.60} ${s*0.20} L${s*0.68} ${s*0.36} Z`} fill={c}/>
          <ellipse cx={s*0.23} cy={s*0.62} rx={s*0.11} ry={s*0.24} fill={a} opacity="0.18"/>
          <ellipse cx={s*0.77} cy={s*0.62} rx={s*0.11} ry={s*0.24} fill={a} opacity="0.18"/>
        </g>
      );
    case 'beaver':
      return (
        <g>
          <circle cx={s*0.31} cy={s*0.35} r={s*0.07} fill={c}/>
          <circle cx={s*0.69} cy={s*0.35} r={s*0.07} fill={c}/>
          <ellipse cx={s*0.82} cy={s*0.79} rx={s*0.11} ry={s*0.18}
                   fill={a} opacity="0.34" transform={`rotate(28 ${s*0.82} ${s*0.79})`}/>
        </g>
      );
    case 'dog':
      return (
        <g>
          <ellipse cx={s*0.28} cy={s*0.40} rx={s*0.08} ry={s*0.15}
                   fill={a} opacity="0.55" transform={`rotate(18 ${s*0.28} ${s*0.40})`}/>
          <ellipse cx={s*0.72} cy={s*0.40} rx={s*0.08} ry={s*0.15}
                   fill={a} opacity="0.55" transform={`rotate(-18 ${s*0.72} ${s*0.40})`}/>
        </g>
      );
    case 'otter':
    default:
      return (
        <g>
          <circle cx={s*0.31} cy={s*0.35} r={s*0.065} fill={c}/>
          <circle cx={s*0.69} cy={s*0.35} r={s*0.065} fill={c}/>
        </g>
      );
  }
}

function renderAnimalFaceDetails(agent, s) {
  const whiskerColor = '#1D242B';
  const whisker = (
    <g opacity="0.55" stroke={whiskerColor} strokeWidth={Math.max(0.7, s*0.010)} strokeLinecap="round">
      <path d={`M${s*0.25} ${s*0.60} L${s*0.12} ${s*0.57}`}/>
      <path d={`M${s*0.25} ${s*0.64} L${s*0.12} ${s*0.66}`}/>
      <path d={`M${s*0.75} ${s*0.60} L${s*0.88} ${s*0.57}`}/>
      <path d={`M${s*0.75} ${s*0.64} L${s*0.88} ${s*0.66}`}/>
    </g>
  );
  switch (agent.animalKind) {
    case 'owl':
      return (
        <g>
          <path d={`M${s*0.47} ${s*0.58} L${s*0.53} ${s*0.58} L${s*0.50} ${s*0.63} Z`}
                fill={agent.accent} opacity="0.78"/>
          <circle cx={s*0.40} cy={s*0.54} r={s*0.07} fill="none" stroke={agent.accent} strokeWidth={Math.max(0.8, s*0.012)} opacity="0.28"/>
          <circle cx={s*0.60} cy={s*0.54} r={s*0.07} fill="none" stroke={agent.accent} strokeWidth={Math.max(0.8, s*0.012)} opacity="0.28"/>
        </g>
      );
    case 'beaver':
      return (
        <g>
          <rect x={s*0.455} y={s*0.665} width={s*0.035} height={s*0.055} rx={s*0.006} fill="#fff" opacity="0.85"/>
          <rect x={s*0.51} y={s*0.665} width={s*0.035} height={s*0.055} rx={s*0.006} fill="#fff" opacity="0.85"/>
        </g>
      );
    case 'dog':
      return (
        <ellipse cx={s*0.50} cy={s*0.60} rx={s*0.040} ry={s*0.030} fill={agent.accent} opacity="0.55"/>
      );
    case 'rabbit':
    case 'fox':
    case 'squirrel':
    case 'otter':
    default:
      return whisker;
  }
}

function renderAccessory(agent, s) {
  const kind = agent.accessoryKind;
  const c = agent.accent;
  switch (kind) {
    case 'headset':
      return (
        <g>
          <path d={`M${s*0.30} ${s*0.36} Q${s*0.50} ${s*0.22} ${s*0.70} ${s*0.36}`}
                stroke={c} strokeWidth={Math.max(1.6, s*0.030)} fill="none" strokeLinecap="round"/>
          <rect x={s*0.27} y={s*0.32} width={s*0.07} height={s*0.10}
                rx={s*0.025} fill={c}/>
          <rect x={s*0.66} y={s*0.32} width={s*0.07} height={s*0.10}
                rx={s*0.025} fill={c}/>
        </g>
      );
    case 'calc':
      return (
        <g>
          <rect x={s*0.36} y={s*0.18} width={s*0.28} height={s*0.18}
                rx={s*0.04} fill={c}/>
          <rect x={s*0.40} y={s*0.22} width={s*0.20} height={s*0.05}
                fill="#FFFFFF" opacity="0.6"/>
          <circle cx={s*0.43} cy={s*0.32} r={s*0.015} fill="#FFFFFF"/>
          <circle cx={s*0.50} cy={s*0.32} r={s*0.015} fill="#FFFFFF"/>
          <circle cx={s*0.57} cy={s*0.32} r={s*0.015} fill="#FFFFFF"/>
        </g>
      );
    case 'megaphone':
      return (
        <g>
          <path d={`M${s*0.36} ${s*0.30} L${s*0.30} ${s*0.22} L${s*0.30} ${s*0.38} Z`}
                fill={c}/>
          <rect x={s*0.36} y={s*0.24} width={s*0.18} height={s*0.12}
                rx={s*0.02} fill={c}/>
          <circle cx={s*0.62} cy={s*0.22} r={s*0.018} fill={c} opacity="0.5"/>
          <circle cx={s*0.66} cy={s*0.27} r={s*0.022} fill={c} opacity="0.4"/>
        </g>
      );
    case 'box':
      return (
        <g>
          <rect x={s*0.36} y={s*0.20} width={s*0.28} height={s*0.18}
                rx={s*0.02} fill={c}/>
          <rect x={s*0.36} y={s*0.20} width={s*0.28} height={s*0.04}
                fill="#FFFFFF" opacity="0.4"/>
          <rect x={s*0.48} y={s*0.20} width={s*0.04} height={s*0.18}
                fill="#FFFFFF" opacity="0.35"/>
        </g>
      );
    case 'chart':
      return (
        <g>
          <rect x={s*0.34} y={s*0.18} width={s*0.32} height={s*0.20}
                rx={s*0.03} fill={c}/>
          <path d={`M${s*0.38} ${s*0.32} L${s*0.45} ${s*0.26} L${s*0.52} ${s*0.30} L${s*0.62} ${s*0.22}`}
                stroke="#FFFFFF" strokeWidth={Math.max(1, s*0.020)} fill="none" strokeLinecap="round"/>
          <circle cx={s*0.62} cy={s*0.22} r={s*0.012} fill="#FFFFFF"/>
        </g>
      );
    case 'heart':
      return (
        <path
          d={`M${s*0.50} ${s*0.38}
             C ${s*0.30} ${s*0.30}, ${s*0.30} ${s*0.16}, ${s*0.43} ${s*0.18}
             C ${s*0.48} ${s*0.19}, ${s*0.50} ${s*0.23}, ${s*0.50} ${s*0.25}
             C ${s*0.50} ${s*0.23}, ${s*0.52} ${s*0.19}, ${s*0.57} ${s*0.18}
             C ${s*0.70} ${s*0.16}, ${s*0.70} ${s*0.30}, ${s*0.50} ${s*0.38} Z`}
          fill={c}/>
      );
    case 'clock':
      return (
        <g>
          <circle cx={s*0.50} cy={s*0.28} r={s*0.11} fill={c}/>
          <circle cx={s*0.50} cy={s*0.28} r={s*0.085} fill="#FFFFFF"/>
          <path d={`M${s*0.50} ${s*0.28} L${s*0.50} ${s*0.22} M${s*0.50} ${s*0.28} L${s*0.555} ${s*0.30}`}
                stroke={c} strokeWidth={Math.max(1, s*0.018)} strokeLinecap="round"/>
        </g>
      );
    default:
      return null;
  }
}

/* AvatarRing — for "team roster" style stacked avatars in lists */
function AvatarRing({ agents, size = 28, max = 4 }) {
  const shown = agents.slice(0, max);
  const more = agents.length - shown.length;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((a, i) => (
        <div key={a.id} style={{
          marginLeft: i === 0 ? 0 : -size * 0.32,
          border: '2px solid var(--semo-surface)',
          borderRadius: '50%',
          background: 'var(--semo-surface)',
          zIndex: shown.length - i,
        }}>
          <BotAvatar agent={a} size={size}/>
        </div>
      ))}
      {more > 0 && (
        <div style={{
          marginLeft: -size * 0.32,
          width: size, height: size,
          borderRadius: '50%',
          background: 'var(--semo-surface-3)',
          border: '2px solid var(--semo-surface)',
          color: 'var(--semo-fg-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.36, fontWeight: 600,
        }}>+{more}</div>
      )}
    </div>
  );
}

export { AGENTS, AGENT_BY_ID, BotAvatar, AvatarRing };
