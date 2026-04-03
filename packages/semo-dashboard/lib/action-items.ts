/**
 * Action Items Parser & Toggle
 *
 * KB의 action-item 마크다운 콘텐츠를 구조화된 ActionItem[]으로 변환하고,
 * 완료 상태 토글 시 마크다운 내용을 수정하는 유틸리티.
 */

export interface ActionItem {
  id: string;
  domain: string;
  domainType: 'team' | 'service';
  domainLabel: string;
  subKey: string;
  itemIndex: number;
  description: string;
  assignee: string | null;
  deadline: string | null;
  status: 'open' | 'completed';
  service: string | null;
  source: string | null;
  date: string;
  resolvedAssignee: string | null;
  resolvedLabel: string | null;
  isTeamMember: boolean;
}

export interface TeamMemberInfo {
  domain: string;
  nickname: string;
  realName: string;
  role: string;
}

export type AliasMap = Map<string, TeamMemberInfo>;

/**
 * 팀원 alias 맵으로 assignee를 정규화한다.
 * nickname, real-name, domain 중 하나라도 매칭되면 해당 팀원으로 resolve.
 */
export function resolveAssignees(items: ActionItem[], aliasMap: AliasMap): void {
  for (const item of items) {
    // team 도메인 아이템: domain 자체가 assignee
    if (item.domainType === 'team') {
      const info = aliasMap.get(item.domain.toLowerCase());
      if (info) {
        item.resolvedAssignee = info.domain;
        item.resolvedLabel = info.nickname || info.domain;
        item.isTeamMember = true;
      }
      continue;
    }

    // service 도메인 아이템: assignee 필드로 resolve
    if (!item.assignee) continue;

    // 쉼표로 구분된 복수 담당자는 첫 번째 팀원으로 resolve
    const candidates = item.assignee.split(/[,、]/).map(s => s.trim());
    for (const candidate of candidates) {
      const info = aliasMap.get(candidate.toLowerCase());
      if (info) {
        item.resolvedAssignee = info.domain;
        item.resolvedLabel = info.nickname || info.domain;
        item.isTeamMember = true;
        break;
      }
    }

    // 매칭 안 된 경우 원본 유지
    if (!item.resolvedAssignee && item.assignee) {
      item.resolvedAssignee = item.assignee;
      item.resolvedLabel = item.assignee;
      item.isTeamMember = false;
    }
  }
}

function extractDate(subKey: string): string {
  const match = subKey.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : subKey;
}

// ── Format 1: Person table ──
// | # | 항목 | 기한 | 상태 | 서비스 | 출처 |
function parsePersonTable(
  content: string,
  domain: string,
  subKey: string,
  domainType: 'team' | 'service',
  domainLabel: string,
): ActionItem[] {
  const lines = content.split('\n');
  const items: ActionItem[] = [];
  let idx = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    // skip header & separator rows
    if (trimmed.includes('| # |') || trimmed.includes('|---|')) continue;

    const cells = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
    // expected: [#, 항목, 기한, 상태, 서비스, 출처]
    if (cells.length < 4) continue;

    const status = cells[3]?.toLowerCase().includes('completed') ? 'completed' as const : 'open' as const;
    items.push({
      id: `${domain}/${subKey}#${idx}`,
      domain,
      domainType,
      domainLabel,
      subKey,
      itemIndex: idx,
      description: cells[1] || '',
      assignee: domainType === 'team' ? domain : null,
      deadline: cells[2] || null,
      status,
      service: cells[4] || null,
      source: cells[5] || null,
      date: extractDate(subKey),
      resolvedAssignee: null,
      resolvedLabel: null,
      isTeamMember: false,
    });
    idx++;
  }
  return items;
}

// ── Format 2: Service specific ──
// - **담당자**: bon
// - **내용**: ...
// - **기한**: ...
// - **상태**: open
function parseServiceSpecific(
  content: string,
  domain: string,
  subKey: string,
  domainType: 'team' | 'service',
  domainLabel: string,
): ActionItem[] {
  const fields: Record<string, string> = {};
  const lines = content.split('\n');

  // heading as title fallback
  let title = '';
  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      title = headingMatch[1].trim();
      continue;
    }
    const fieldMatch = line.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)$/);
    if (fieldMatch) {
      fields[fieldMatch[1]] = fieldMatch[2].trim();
    }
  }

  const description = fields['내용'] || title || '';
  if (!description) return [];

  const status = fields['상태']?.toLowerCase().includes('completed') ? 'completed' as const : 'open' as const;

  return [{
    id: `${domain}/${subKey}#0`,
    domain,
    domainType,
    domainLabel,
    subKey,
    itemIndex: 0,
    description,
    assignee: fields['담당자'] || null,
    deadline: fields['기한'] || null,
    status,
    service: domainType === 'service' ? domain : null,
    source: fields['출처'] || null,
    date: extractDate(subKey),
    resolvedAssignee: null,
    resolvedLabel: null,
    isTeamMember: false,
  }];
}

// ── Format 3: Service batch (checkbox list) ──
// ### Name
// - [ ] item text
// - [x] completed item
function parseServiceBatch(
  content: string,
  domain: string,
  subKey: string,
  domainType: 'team' | 'service',
  domainLabel: string,
): ActionItem[] {
  const lines = content.split('\n');
  const items: ActionItem[] = [];
  let currentAssignee: string | null = null;
  let idx = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)/);
    if (headingMatch) {
      // "Reus (세미콜론)" → "Reus"
      currentAssignee = headingMatch[1].replace(/\s*\(.+\)\s*$/, '').trim();
      continue;
    }

    const checkboxMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (checkboxMatch) {
      const completed = checkboxMatch[1].toLowerCase() === 'x';
      items.push({
        id: `${domain}/${subKey}#${idx}`,
        domain,
        domainType,
        domainLabel,
        subKey,
        itemIndex: idx,
        description: checkboxMatch[2].trim(),
        assignee: currentAssignee,
        deadline: null,
        status: completed ? 'completed' : 'open',
        service: domainType === 'service' ? domain : null,
        source: null,
        date: extractDate(subKey),
        resolvedAssignee: null,
        resolvedLabel: null,
        isTeamMember: false,
      });
      idx++;
    }
  }
  return items;
}

/**
 * KB action-item 콘텐츠를 파싱하여 ActionItem[] 반환.
 * 3가지 포맷을 자동 감지한다.
 */
export function parseActionItems(
  content: string,
  domain: string,
  subKey: string,
  domainType: 'team' | 'service',
  domainLabel: string,
): ActionItem[] {
  if (!content) return [];

  if (content.includes('| # |') || content.includes('| 항목 |')) {
    return parsePersonTable(content, domain, subKey, domainType, domainLabel);
  }
  if (content.includes('- **담당자**:')) {
    return parseServiceSpecific(content, domain, subKey, domainType, domainLabel);
  }
  if (/- \[[ xX]\]/.test(content)) {
    return parseServiceBatch(content, domain, subKey, domainType, domainLabel);
  }

  // fallback: try each parser
  for (const parser of [parsePersonTable, parseServiceSpecific, parseServiceBatch]) {
    const result = parser(content, domain, subKey, domainType, domainLabel);
    if (result.length > 0) return result;
  }
  return [];
}

/**
 * 마크다운 콘텐츠 내 특정 아이템의 상태를 토글한 새 content를 반환한다.
 */
export function toggleItemInContent(
  content: string,
  itemIndex: number,
  completed: boolean,
): string {
  // Format 1: table — change status cell
  if (content.includes('| # |') || content.includes('| 항목 |')) {
    const lines = content.split('\n');
    let dataRowIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed.startsWith('|')) continue;
      if (trimmed.includes('| # |') || trimmed.includes('|---|')) continue;
      const cells = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length < 4) continue;

      if (dataRowIdx === itemIndex) {
        const newStatus = completed ? 'completed' : 'open';
        // replace the 4th cell (status)
        const parts = lines[i].split('|');
        // parts: ['', ' # ', ' 항목 ', ' 기한 ', ' 상태 ', ' 서비스 ', ' 출처 ', '']
        let cellIdx = 0;
        for (let p = 0; p < parts.length; p++) {
          if (parts[p].trim() === '') continue;
          if (cellIdx === 3) {
            parts[p] = ` ${newStatus} `;
            break;
          }
          cellIdx++;
        }
        lines[i] = parts.join('|');
        return lines.join('\n');
      }
      dataRowIdx++;
    }
    return content;
  }

  // Format 2: specific — change 상태 field
  if (content.includes('- **담당자**:')) {
    const newStatus = completed ? 'completed' : 'open';
    return content.replace(
      /^(-\s+\*\*상태\*\*:\s*).+$/m,
      `$1${newStatus}`,
    );
  }

  // Format 3: batch — toggle checkbox
  if (/- \[[ xX]\]/.test(content)) {
    const lines = content.split('\n');
    let checkboxIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^-\s+\[[ xX]\]/.test(lines[i])) {
        if (checkboxIdx === itemIndex) {
          lines[i] = completed
            ? lines[i].replace(/- \[ \]/, '- [x]')
            : lines[i].replace(/- \[[xX]\]/, '- [ ]');
          return lines.join('\n');
        }
        checkboxIdx++;
      }
    }
    return content;
  }

  return content;
}

// ── CRUD Helpers ──

export interface NewActionItem {
  description: string;
  assignee?: string;
  deadline?: string;
  service?: string;
}

/**
 * Format 2 마크다운으로 새 액션 아이템 생성
 */
export function generateNewContent(item: NewActionItem): string {
  const lines = [`## ${item.description}`, ''];
  if (item.assignee) lines.push(`- **담당자**: ${item.assignee}`);
  lines.push(`- **내용**: ${item.description}`);
  if (item.deadline) lines.push(`- **기한**: ${item.deadline}`);
  lines.push(`- **상태**: open`);
  if (item.service) lines.push(`- **서비스**: ${item.service}`);
  lines.push(`- **출처**: dashboard`);
  return lines.join('\n');
}

/**
 * 기존 content에서 특정 인덱스의 아이템을 제거
 */
export function removeItemFromContent(content: string, itemIndex: number): string {
  // Format 1: table
  if (content.includes('| # |') || content.includes('| 항목 |')) {
    const lines = content.split('\n');
    let dataRowIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed.startsWith('|')) continue;
      if (trimmed.includes('| # |') || trimmed.includes('|---|')) continue;
      const cells = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length < 4) continue;
      if (dataRowIdx === itemIndex) {
        lines.splice(i, 1);
        return lines.join('\n');
      }
      dataRowIdx++;
    }
    return content;
  }

  // Format 2: single item per entry — return empty
  if (content.includes('- **담당자**:') || content.includes('- **내용**:')) {
    return '';
  }

  // Format 3: checkbox
  if (/- \[[ xX]\]/.test(content)) {
    const lines = content.split('\n');
    let checkboxIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^-\s+\[[ xX]\]/.test(lines[i])) {
        if (checkboxIdx === itemIndex) {
          lines.splice(i, 1);
          return lines.join('\n');
        }
        checkboxIdx++;
      }
    }
    return content;
  }

  return content;
}

/**
 * 기존 content 내 특정 인덱스 아이템의 description을 수정
 */
export function updateItemInContent(
  content: string,
  itemIndex: number,
  updates: { description?: string; deadline?: string; assignee?: string },
): string {
  // Format 2: field-based
  if (content.includes('- **담당자**:') || content.includes('- **내용**:')) {
    let result = content;
    if (updates.description) {
      result = result.replace(/^(##\s+).+$/m, `$1${updates.description}`);
      result = result.replace(/^(-\s+\*\*내용\*\*:\s*).+$/m, `$1${updates.description}`);
    }
    if (updates.deadline) {
      if (result.includes('- **기한**:')) {
        result = result.replace(/^(-\s+\*\*기한\*\*:\s*).+$/m, `$1${updates.deadline}`);
      } else {
        result = result.replace(/^(-\s+\*\*상태\*\*:)/m, `- **기한**: ${updates.deadline}\n$1`);
      }
    }
    if (updates.assignee) {
      result = result.replace(/^(-\s+\*\*담당자\*\*:\s*).+$/m, `$1${updates.assignee}`);
    }
    return result;
  }

  // Format 3: checkbox — update description
  if (/- \[[ xX]\]/.test(content) && updates.description) {
    const lines = content.split('\n');
    let checkboxIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(-\s+\[[ xX]\]\s+).+$/);
      if (m) {
        if (checkboxIdx === itemIndex) {
          lines[i] = `${m[1]}${updates.description}`;
          return lines.join('\n');
        }
        checkboxIdx++;
      }
    }
  }

  return content;
}
