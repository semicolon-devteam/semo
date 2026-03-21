// E2E 테스트용 모킹 데이터

export const mockBots = [
  {
    id: 'semiclaw',
    name: 'SemiClaw',
    emoji: '🦀',
    role: 'PM/오케스트레이터',
    status: 'online',
    lastActive: new Date().toISOString(),
    sessionCount: 5,
    workspacePath: 'semo-system/bot-workspaces/semiclaw',
    syncedAt: new Date().toISOString(),
  },
  {
    id: 'workclaw',
    name: 'WorkClaw',
    emoji: '⚙️',
    role: '풀스택 구현',
    status: 'online',
    lastActive: new Date().toISOString(),
    sessionCount: 3,
    workspacePath: 'semo-system/bot-workspaces/workclaw',
    syncedAt: new Date().toISOString(),
  },
  {
    id: 'reviewclaw',
    name: 'ReviewClaw',
    emoji: '🔍',
    role: '코드 리뷰/QA',
    status: 'online',
    lastActive: new Date().toISOString(),
    sessionCount: 2,
    workspacePath: 'semo-system/bot-workspaces/reviewclaw',
    syncedAt: new Date().toISOString(),
  },
];

export const mockSessions = [
  {
    sessionKey: 'session-1',
    label: '#proj-ps',
    kind: 'main',
    chatType: 'channel',
    lastActivity: new Date().toISOString(),
    messageCount: 42,
  },
  {
    sessionKey: 'session-2',
    label: '#bot-ops',
    kind: 'main',
    chatType: 'channel',
    lastActivity: new Date().toISOString(),
    messageCount: 18,
  },
];

export const mockKBItems = [
  {
    kb_id: 1,
    domain: 'team',
    key: 'onboarding-guide',
    content: 'Semicolon 팀 온보딩 가이드 전문...',
    created_by: 'Reus',
    updated_at: new Date().toISOString(),
  },
  {
    kb_id: 2,
    domain: 'decision',
    key: 'bot-merge-policy',
    content: '봇은 절대 머지 금지 (2026-02-27)',
    created_by: 'ReviewClaw',
    updated_at: new Date().toISOString(),
  },
  {
    kb_id: 3,
    domain: 'tech',
    key: 'semo-architecture',
    content: 'SEMO 3-Layer Architecture 설명...',
    created_by: 'WorkClaw',
    updated_at: new Date().toISOString(),
  },
];

export const mockSearchResults = [
  {
    ...mockKBItems[0],
    similarity_pct: 95,
  },
  {
    ...mockKBItems[1],
    similarity_pct: 82,
  },
];

export const mockDomains = ['team', 'decision', 'tech', 'process'];

export const mockStats = {
  total: 42,
  byDomain: {
    team: 10,
    decision: 8,
    tech: 15,
    process: 9,
  },
  recentUpdates: 5,
};
