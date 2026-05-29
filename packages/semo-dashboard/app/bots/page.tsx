import Link from 'next/link';
import type { Bot } from '@/types';
import { query } from '@/lib/db';
import { getItem } from '@/lib/kb';
import RuntimeSourceChart from '@/components/RuntimeSourceChart';
import SystemHealthBanner from '@/components/SystemHealthBanner';
import { PageBody, PageHeader, Card, Badge } from '@/components/ui/semo';

const AVATAR_COLORS = [
  'var(--agent-peach)',
  'var(--agent-mint)',
  'var(--agent-lavender)',
  'var(--agent-coral)',
  'var(--agent-sky)',
  'var(--agent-butter)',
  'var(--agent-rose)',
];

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '-';
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** 봇 상태 카드 — 고객 screen-team AgentCard 미감 이식. */
function BotStatusCard({ bot, idx }: { bot: Bot; idx: number }) {
  const online = bot.status === 'online';
  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  // 봇 이모지는 KB 에 :shortcode: (슬랙형)로 저장될 수 있음 → 유니코드면 그대로, 아니면 이름 이니셜.
  const emoji = bot.emoji && !bot.emoji.includes(':') ? bot.emoji : bot.name?.[0] || '\u{1F916}';
  return (
    <Link
      href={`/bots/${bot.id}`}
      style={{
        display: 'grid',
        gap: 12,
        background: 'var(--semo-surface)',
        border: '1px solid var(--semo-line)',
        borderRadius: 'var(--r-14)',
        padding: 16,
        boxShadow: 'var(--semo-shadow-1)',
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--r-12)',
            background: color,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--semo-fg-1)',
            flexShrink: 0,
          }}
        >
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--semo-fg-1)' }}>
              {bot.name}
            </span>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: online ? 'var(--semo-success)' : 'var(--semo-fg-faint)',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--semo-fg-3)', marginTop: 2 }}>{bot.role}</div>
        </div>
        <Badge tone={online ? 'success' : 'neutral'}>{online ? '온라인' : '오프라인'}</Badge>
      </div>
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--semo-cream)',
          borderRadius: 'var(--r-10)',
          border: '1px solid var(--semo-line-soft)',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--semo-fg-1)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          세션 {bot.sessionCount}개
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--semo-fg-3)', marginTop: 2 }}>
          마지막 활동 {relTime(bot.lastActive)}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--semo-fg-muted)',
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {bot.workspacePath}
      </div>
    </Link>
  );
}

export const dynamic = 'force-dynamic';

interface BotStatusRow {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  last_active: string | null;
  session_count: number;
  workspace_path: string;
  status: 'online' | 'offline';
}

function parseIdentityContent(
  content: string,
  botId: string,
): { name: string; emoji: string; role: string } {
  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(\S+)/);
  const roleMatch = content.match(/\*\*(?:Creature|Role|직책):\*\*\s*(.+)/);
  return {
    name: nameMatch ? nameMatch[1].trim() : botId,
    emoji: emojiMatch ? emojiMatch[1].trim() : '',
    role: roleMatch ? roleMatch[1].trim() : 'Bot',
  };
}

async function enrichBotMetadata(
  botId: string,
): Promise<{ name: string; emoji: string; role: string }> {
  // 1. KB identity (SoT)
  try {
    const entry = await getItem('bot-config', `${botId}/identity`);
    if (entry?.content) return parseIdentityContent(entry.content, botId);
  } catch {
    /* KB unavailable */
  }
  // 2. bot_workspace_files fallback
  try {
    const dbResult = await query<{ content: string }>(
      `SELECT content FROM semo.bot_workspace_files WHERE bot_id = $1 AND file_path = 'IDENTITY.md'`,
      [botId],
    );
    if (dbResult.rows.length > 0) return parseIdentityContent(dbResult.rows[0].content, botId);
  } catch {
    /* DB fallback failed */
  }
  return { name: botId, emoji: '', role: 'Bot' };
}

async function getBots(): Promise<Bot[]> {
  const result = await query<BotStatusRow>(`
    SELECT bot_id, name, emoji, role, last_active, session_count, workspace_path, status
    FROM semo.bot_status
    ORDER BY bot_id
  `);

  return Promise.all(
    result.rows.map(async (row): Promise<Bot> => {
      let { name, emoji, role } = row;

      if (!name || !emoji || !role) {
        const meta = await enrichBotMetadata(row.bot_id);
        name = name || meta.name;
        emoji = emoji || meta.emoji;
        role = role || meta.role;
      }

      return {
        id: row.bot_id,
        name: name || row.bot_id,
        emoji: emoji || '',
        role: role || 'Bot',
        status: row.status || 'offline',
        lastActive: row.last_active || new Date().toISOString(),
        sessionCount: row.session_count || 0,
        workspacePath: row.workspace_path || `~/.semo/workspaces/${row.bot_id}`,
      };
    }),
  );
}

export default async function BotsPage() {
  let bots: Bot[] = [];
  let error = false;

  try {
    bots = await getBots();
  } catch (e) {
    console.error('Failed to fetch bots:', e);
    error = true;
  }

  return (
    <PageBody>
      <PageHeader title="봇 팀 현황" sub="모든 봇의 활동과 상태를 모니터링합니다" />

      <div style={{ display: 'grid', gap: 20 }}>
        <SystemHealthBanner />
        <RuntimeSourceChart days={7} />

        {error ? (
          <Card style={{ textAlign: 'center', padding: 48, color: 'var(--semo-danger)' }}>
            DB 연결에 실패했습니다.
          </Card>
        ) : bots.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 48, color: 'var(--semo-fg-3)' }}>
            등록된 봇이 없습니다.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bots.map((bot, i) => (
              <BotStatusCard key={bot.id} bot={bot} idx={i} />
            ))}
          </div>
        )}
      </div>
    </PageBody>
  );
}
