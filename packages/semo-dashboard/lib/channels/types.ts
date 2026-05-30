/**
 * Provider-neutral channel types for the customer dashboard.
 *
 * Channels = 외부 메시징 통합 (KakaoTalk, Slack, Telegram, Discord, Email, LINE, Instagram).
 * KakaoTalk 이 한국 SMB 타겟 1순위. Slack 은 내부 엔지니어링 레퍼런스.
 * DB SoT = `public.tenant_channels` (마이그 014, 병렬 작업으로 생성됨).
 *
 * 본 파일은 타입 + Korean label 매핑만 정의한다. 토큰 암호화는 ./credentials.ts,
 * DB 쿼리는 ./data.ts. OAuth 실제 핸들러는 Phase 2B 별도 PR.
 */

/** 지원 채널 종류. tenant_channels.channel_type ENUM 과 1:1 대응. */
export type ChannelType =
  | 'slack'
  | 'kakao'
  | 'telegram'
  | 'discord'
  | 'email'
  | 'line'
  | 'instagram'
  | 'google';

/** 채널 연결 상태. tenant_channels.status ENUM 과 1:1 대응. */
export type ChannelStatus = 'connected' | 'expired' | 'error' | 'revoked' | 'pending';

/**
 * 테넌트가 연결한 외부 채널 한 건. snake_case row 를 camelCase 로 매핑한 결과.
 * 토큰/credentials 는 DB 의 별도 컬럼(encrypted)에 있고, 이 타입엔 노출하지 않는다.
 */
export interface TenantChannel {
  id: string;
  tenantId: string;
  channelType: ChannelType;
  /** 외부 워크스페이스/팀 ID (Slack team_id, Kakao channel_id 등). */
  externalWorkspaceId: string | null;
  /** 표시용 외부 팀명(사용자가 본 그대로). */
  externalTeamName: string | null;
  status: ChannelStatus;
  /** MVP 기본값 false — outbound 메시지 전송은 사장님이 명시적으로 켜야 한다. */
  outboundEnabled: boolean;
  tokenExpiresAt: string | null;
  lastSeenAt: string | null;
  lastRefreshError: string | null;
  connectedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 채널을 통해 주고받은 메시지 한 건. channel_messages row 의 camelCase 매핑. */
export interface ChannelMessage {
  id: string;
  tenantChannelId: string;
  direction: 'inbound' | 'outbound';
  /** 외부 채널 native 메시지 ID (Slack ts, Kakao message_id 등). */
  externalMessageId: string | null;
  /** 외부 conversation/thread/room ID. */
  externalConversationId: string | null;
  /** 외부 sender ID (Slack user, Kakao user_key 등). */
  externalSenderId: string | null;
  bodyText: string | null;
  /** raw payload (provider-specific, JSON). */
  bodyJson: unknown;
  postedAt: string;
  createdAt: string;
}

/** 사장님이 보는 채널 이름(한국어). 카탈로그/연결 UI 에서 사용. */
export const CHANNEL_LABEL: Record<ChannelType, string> = {
  kakao: '카카오톡 채널',
  slack: '슬랙',
  telegram: '텔레그램',
  discord: '디스코드',
  email: '이메일',
  line: '라인',
  instagram: '인스타그램',
  google: 'Google',
};

/** 브랜드 컬러(hex 근사치). 카드 dot, 배경 강조에 사용. */
export const CHANNEL_BRAND_COLOR: Record<ChannelType, string> = {
  kakao: '#FEE500',
  slack: '#4A154B',
  telegram: '#26A5E4',
  discord: '#5865F2',
  email: '#6E5BD1',
  line: '#06C755',
  instagram: '#E4405F',
  google: '#4285F4',
};

/**
 * agent_listings.integrations 의 한국어 라벨 → ChannelType 매핑.
 * RecruitStep2 가 listing.integrations 를 그대로 보여주므로, "연결하기" 클릭 시
 * 어떤 채널로 점프할지 알아내야 한다. 매핑 없는 라벨은 undefined → 일반 페이지로.
 *
 * "인스타 DM" 과 "인스타그램" 둘 다 instagram 으로 정규화한다.
 */
export const LABEL_TO_CHANNEL: Record<string, ChannelType | undefined> = {
  '카카오톡 채널': 'kakao',
  카카오톡: 'kakao',
  슬랙: 'slack',
  텔레그램: 'telegram',
  디스코드: 'discord',
  '인스타 DM': 'instagram',
  인스타그램: 'instagram',
  이메일: 'email',
  라인: 'line',
  'Google Calendar': 'google',
};
