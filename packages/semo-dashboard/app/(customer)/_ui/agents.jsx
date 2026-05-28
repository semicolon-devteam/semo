/*
 * agents.jsx — SEMO agent personas + BotAvatar character component.
 *
 * Style #3 picked by user: warm cream face plate, peach-toned skin,
 * round eyes, blush cheeks, friendly mouth — slight illustrationy
 * caricature, definitely NOT a sci-fi robot. Each agent gets a different
 * body color (from --agent-* palette) and a tiny role-accessory on top
 * of the head so they're individually recognizable at a glance.
 *
 * Exports (to window): AGENTS, AGENT_BY_ID, BotAvatar, AvatarRing.
 */

const AGENTS = [
  {
    id: 'jumuni',
    name: '주문이',
    role: '주문 응대 직원',
    dept: '응대',
    color: 'var(--agent-peach)',
    accent: '#E07A3B',
    accessoryKind: 'headset',          // 카카오톡 응대 → 헤드셋
    bio: '카카오톡·인스타 DM 으로 들어오는 주문과 문의에 답해요. 단골 손님의 취향도 기억하고 있어요.',
    skills: ['카카오톡 상담', '주문 접수', '단골 인식'],
    integrations: ['카카오톡 채널', '인스타 DM', '스마트스토어'],
    rating: 4.8,
    employers: 1284,
    priceTier: 'Starter',
  },
  {
    id: 'hwegyedo-ri',
    name: '회계도리',
    role: '회계·세무 직원',
    dept: '회계',
    color: 'var(--agent-mint)',
    accent: '#2E9670',
    accessoryKind: 'calc',             // 회계 → 계산기 모자
    bio: '매일 매출·지출을 자동 분류하고, 주간/월간 리포트를 만들어요. 세금계산서도 챙겨요.',
    skills: ['매출 자동 분류', '월간 리포트', '세금계산서'],
    integrations: ['카드 단말기', '국세청 홈택스', '엑셀 내보내기'],
    rating: 4.9,
    employers: 942,
    priceTier: 'Pro',
  },
  {
    id: 'algorim-i',
    name: '알리미',
    role: '마케팅·SNS 직원',
    dept: '마케팅',
    color: 'var(--agent-lavender)',
    accent: '#6E5BD1',
    accessoryKind: 'megaphone',
    bio: '인스타·블로그용 게시물을 초안으로 만들고, 시그니처 메뉴를 자랑해요.',
    skills: ['게시물 초안', '해시태그 추천', '리뷰 답글'],
    integrations: ['인스타그램', '네이버 블로그'],
    rating: 4.6,
    employers: 768,
    priceTier: 'Pro',
  },
  {
    id: 'chae-wo',
    name: '채워',
    role: '재고·발주 직원',
    dept: '재고',
    color: 'var(--agent-coral)',
    accent: '#D9543F',
    accessoryKind: 'box',
    bio: '재고가 떨어지기 전에 미리 알려주고, 발주서를 초안으로 준비해요.',
    skills: ['재고 모니터링', '발주 초안', '유통기한 알림'],
    integrations: ['스마트스토어', '엑셀 재고표'],
    rating: 4.7,
    employers: 521,
    priceTier: 'Starter',
  },
  {
    id: 'sem-i',
    name: '셈이',
    role: '매출 분석 직원',
    dept: '분석',
    color: 'var(--agent-sky)',
    accent: '#1F7AC9',
    accessoryKind: 'chart',
    bio: '매출 흐름과 메뉴별 인기를 분석해서 "오늘 알아두면 좋은 한 가지" 를 알려줘요.',
    skills: ['일별 매출 인사이트', '메뉴 인기', '시간대 분석'],
    integrations: ['카드 단말기', 'POS'],
    rating: 4.7,
    employers: 612,
    priceTier: 'Starter',
  },
  {
    id: 'dangol-i',
    name: '단골이',
    role: 'CS·단골 관리 직원',
    dept: 'CS',
    color: 'var(--agent-butter)',
    accent: '#B27418',
    accessoryKind: 'heart',
    bio: '단골 손님을 알아보고, 생일이나 자주 오시는 날을 기억했다가 인사해요.',
    skills: ['단골 인식', '리뷰 답글', '재방문 유도'],
    integrations: ['카카오톡 채널', '문자 발송'],
    rating: 4.8,
    employers: 487,
    priceTier: 'Starter',
  },
  {
    id: 'bi-seo',
    name: '비서',
    role: '스케줄 직원',
    dept: '스케줄',
    color: 'var(--agent-rose)',
    accent: '#C66095',
    accessoryKind: 'clock',
    bio: '미팅 일정을 잡고, 회의록을 정리해서 가게 지식에 보관해요.',
    skills: ['일정 조율', '회의록 자동 저장', '리마인드'],
    integrations: ['Google Calendar', '카카오톡'],
    rating: 4.9,
    employers: 312,
    priceTier: 'Pro',
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
