/**
 * /dashboard/settings/integrations — 연동 관리 페이지 (MVP 스캐폴드).
 *
 * 사장님이 가게에 어떤 채널(카카오톡/슬랙/...)을 붙였는지 보고 관리한다.
 * MVP 는 read-only 스캐폴드 — 실제 OAuth 연결 핸들러는 Phase 2B 별도 PR.
 *
 * 데이터는 tenant_channels 테이블에서 읽고, 카탈로그(`CHANNEL_LABEL`)와 합쳐
 * "연결된 채널" + "사용 가능한 채널(아직 안 붙인 종류)" 두 섹션으로 보여준다.
 *
 * `?focus=<라벨>` 쿼리는 RecruitStep2 "연결하기" 에서 점프 시 어떤 채널을
 * 하이라이트할지 힌트 — `LABEL_TO_CHANNEL` 로 정규화한 ChannelType 카드를 강조.
 */
import { requireOwnedTenantSlug } from '@/lib/customer/data';
import { listTenantChannels } from '@/lib/channels/data';
import {
  CHANNEL_BRAND_COLOR,
  CHANNEL_LABEL,
  LABEL_TO_CHANNEL,
  type ChannelType,
  type TenantChannel,
} from '@/lib/channels/types';
import {
  Badge,
  Card,
  PageBody,
  PageHeader,
  Section,
  btnStyle,
  type SemoTone,
} from '@/components/ui/semo';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ focus?: string; ok?: string; err?: string }>;
}

const STATUS_TONE: Record<TenantChannel['status'], SemoTone> = {
  connected: 'success',
  expired: 'warning',
  error: 'danger',
  revoked: 'neutral',
  pending: 'primary',
};
const STATUS_LABEL: Record<TenantChannel['status'], string> = {
  connected: '연결됨',
  expired: '토큰 만료',
  error: '오류',
  revoked: '해제됨',
  pending: '대기 중',
};

function relTime(iso: string | null): string {
  if (!iso) return '기록 없음';
  const t = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.round(hrs / 24);
  return `${days}일 전`;
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const tenantSlug = await requireOwnedTenantSlug();
  const sp = await searchParams;
  const focusLabel = sp.focus ?? null;
  const focusChannel: ChannelType | null = focusLabel
    ? (LABEL_TO_CHANNEL[focusLabel] ?? null)
    : null;
  const okFlag = sp.ok ?? null;
  const errFlag = sp.err ?? null;
  const okMessage =
    okFlag === 'google'
      ? '✓ Google 연동 완료'
      : okFlag === 'disconnect'
        ? '✓ 채널 해제 완료'
        : null;

  const channels = await listTenantChannels(tenantSlug);
  const connectedTypes = new Set<ChannelType>(channels.map((c) => c.channelType));
  const availableTypes = (Object.keys(CHANNEL_LABEL) as ChannelType[]).filter(
    (t) => !connectedTypes.has(t),
  );

  return (
    <PageBody>
      <PageHeader
        title="연동 관리"
        sub={`${tenantSlug} · 연결된 채널 ${channels.length}개`}
        eyebrow="Settings"
      />

      {okMessage && (
        <Card
          style={{
            marginBottom: 20,
            background: 'var(--semo-success-bg)',
            borderColor: 'transparent',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--semo-success)', fontWeight: 600 }}>
            {okMessage}
          </div>
        </Card>
      )}

      {errFlag && (
        <Card
          style={{
            marginBottom: 20,
            background: 'var(--semo-danger-bg)',
            borderColor: 'transparent',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--semo-danger)', fontWeight: 600 }}>
            오류: {errFlag}
          </div>
        </Card>
      )}

      {focusLabel && (
        <Card
          style={{
            marginBottom: 20,
            background: 'var(--semo-primary-08)',
            borderColor: 'var(--semo-primary-16)',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--semo-fg-2)' }}>
            <strong>{focusLabel}</strong>
            {focusChannel
              ? ' 연결을 시작하려고 했어요. 아래 "사용 가능한 채널" 카드에서 이어가실 수 있어요.'
              : ' 항목은 아직 매핑된 채널이 없어요. 운영팀에 알려주세요.'}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 32 }}>
        <Section
          title="연결된 채널"
          hint={channels.length === 0 ? '아직 없음' : `${channels.length}개`}
        >
          {channels.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 36, color: 'var(--semo-fg-3)' }}>
              <div style={{ fontSize: 14 }}>아직 연결된 채널이 없습니다.</div>
              <div style={{ fontSize: 12.5, marginTop: 6 }}>
                사용 가능한 채널에서 연결하세요. (현재 모든 OAuth 는 후속 PR.)
              </div>
            </Card>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 14,
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              }}
            >
              {channels.map((c) => (
                <ConnectedCard key={c.id} channel={c} />
              ))}
            </div>
          )}
        </Section>

        <Section title="사용 가능한 채널" hint={`${availableTypes.length}개 종류`}>
          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {availableTypes.map((t) => (
              <AvailableCard key={t} channelType={t} highlighted={focusChannel === t} />
            ))}
          </div>
          <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--semo-fg-3)' }}>
            OAuth 핸들러는 후속 PR 에서 추가됩니다. 카카오톡 채널이 1순위.
          </p>
        </Section>
      </div>
    </PageBody>
  );
}

function ConnectedCard({ channel }: { channel: TenantChannel }) {
  const label = CHANNEL_LABEL[channel.channelType];
  const color = CHANNEL_BRAND_COLOR[channel.channelType];
  return (
    <Card padding={18}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
              boxShadow: '0 0 0 3px rgba(0,0,0,0.04)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--semo-fg-1)',
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--semo-fg-3)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {channel.externalTeamName ?? channel.externalWorkspaceId ?? '이름 없음'}
            </div>
          </div>
          <Badge tone={STATUS_TONE[channel.status]}>{STATUS_LABEL[channel.status]}</Badge>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--semo-fg-3)',
          }}
        >
          <span>최근 활동 {relTime(channel.lastSeenAt)}</span>
          <span>
            발송{' '}
            {channel.outboundEnabled ? (
              <Badge tone="success">ON</Badge>
            ) : (
              <Badge tone="neutral">OFF</Badge>
            )}
          </span>
        </div>

        {channel.lastRefreshError && (
          <div
            style={{
              fontSize: 12,
              padding: '6px 10px',
              background: 'var(--semo-danger-bg)',
              color: 'var(--semo-danger)',
              borderRadius: 'var(--r-8)',
            }}
          >
            {channel.lastRefreshError}
          </div>
        )}

        <form method="POST" action="/api/channels/disconnect">
          <input type="hidden" name="channel_id" value={channel.id} />
          <button
            type="submit"
            style={{
              ...btnStyle('ghost'),
              fontSize: 13,
              padding: '6px 12px',
            }}
          >
            해제
          </button>
        </form>
      </div>
    </Card>
  );
}

function AvailableCard({
  channelType,
  highlighted,
}: {
  channelType: ChannelType;
  highlighted: boolean;
}) {
  const label = CHANNEL_LABEL[channelType];
  const color = CHANNEL_BRAND_COLOR[channelType];
  const isGoogle = channelType === 'google';
  return (
    <Card
      padding={18}
      style={
        highlighted
          ? {
              borderColor: 'var(--semo-primary)',
              boxShadow: '0 0 0 3px var(--semo-primary-16)',
            }
          : undefined
      }
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
              boxShadow: '0 0 0 3px rgba(0,0,0,0.04)',
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--semo-fg-1)' }}>{label}</div>
          <span style={{ marginLeft: 'auto' }}>
            {isGoogle ? (
              <Badge tone="primary">사용 가능</Badge>
            ) : (
              <Badge tone="warning">준비 중</Badge>
            )}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--semo-fg-3)', lineHeight: 1.5 }}>
          {isGoogle
            ? 'Google 계정으로 캘린더·메일 채널을 연결합니다.'
            : 'OAuth 핸들러 미구현 — 후속 PR'}
        </div>
        {isGoogle ? (
          <a href="/api/channels/google/start" style={btnStyle('primary')}>
            연결하기
          </a>
        ) : (
          <button
            type="button"
            disabled
            style={{
              ...btnStyle('primary'),
              opacity: 0.55,
              cursor: 'not-allowed',
            }}
            title="OAuth 핸들러는 후속 PR"
          >
            연결하기 (준비 중)
          </button>
        )}
      </div>
    </Card>
  );
}
