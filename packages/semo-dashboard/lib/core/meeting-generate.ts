/**
 * Meeting Notes Generation Engine
 *
 * Uses Anthropic API to analyze transcripts and produce structured meeting notes.
 * Supports two modes:
 * - Preview (dry-run): Returns analysis + Discussion body + KB entries without creating anything
 * - Generate (commit): Creates GitHub Discussion, writes KB entries, sends Slack
 */

import { createMeetingDiscussion } from './meeting-github';
import { upsertItem } from './kb';
import { syncMeetingToNotion, updateNotionSync } from './meeting-notion';
import type { Meeting } from './meeting';

// ── Anthropic API ──

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  return key;
}

export type AttributionConfidence = 'high' | 'low' | 'ambiguous';

export interface MeetingAnalysis {
  meeting_time: string;
  meeting_type_label: string;
  agenda_items: string;
  decisions: {
    title: string;
    content: string;
    background: string;
    assignee: string;
    related_project?: string;
    confidence?: AttributionConfidence;
    domain_rationale?: string;
  }[];
  kpi_changes: {
    project: string;
    kpi: string;
    change: string;
    before: string;
    after: string;
    note: string;
    confidence?: AttributionConfidence;
  }[];
  action_items: { assignee: string; item: string; deadline: string }[];
  next_meeting: string;
  additional_notes: string;
}

const SYSTEM_PROMPT_TEMPLATE = `You are a meeting minutes analyst for Semicolon development team.
Analyze the transcript and extract structured information in JSON format.

CRITICAL RULES:
- Output ONLY valid JSON, no markdown wrapping
- All text must be in Korean (matching the transcript language)
- Only include sections that have actual content from the transcript
- For decisions, action_items, kpi_changes: return empty arrays [] if none found
- assignee names should use Korean names from the transcript
- Dates should use YYYY-MM-DD format
- meeting_time: infer from context or use the meeting_date provided
- meeting_type_label: "정기 회고&회의" for regular, specific type for adhoc

SERVICE ATTRIBUTION RULES:
- For each decision and KPI change, set related_project/project to the exact domain name from the SERVICE CONTEXT below.
- Platform services have sub-services (e.g., "wise-platform" is the parent; "tether-mining", "orbis", "onto-media" are distinct sub-services). Attribute items to the specific sub-service, NOT the parent platform.
- If attribution is unclear between multiple services, set confidence to "low" and provide domain_rationale explaining the ambiguity.
- If a topic was explicitly decided or rejected in the meeting, reflect that status accurately. Do not list already-decided items as pending.
- If an item is about the organization in general (not a specific service), set related_project to empty string.
- Set confidence to "high" when you are certain of the attribution, "low" when plausible but uncertain, "ambiguous" when multiple services could own it.

{service_context}`;

const USER_PROMPT_TEMPLATE = `Meeting metadata:
- Type: {meeting_type}
- Date: {meeting_date}
- Title: {title}
- Attendees: {attendees}

Transcript:
---
{transcript}
---

Extract the following as JSON:
{
  "meeting_time": "YYYY-MM-DD HH:MM-HH:MM",
  "meeting_type_label": "정기 회고&회의 or descriptive label",
  "agenda_items": "markdown formatted agenda with bullet points",
  "decisions": [{"title": "...", "content": "...", "background": "...", "assignee": "...", "related_project": "exact domain name from SERVICE CONTEXT or empty string", "confidence": "high|low|ambiguous", "domain_rationale": "why this domain (required if confidence is not high)"}],
  "kpi_changes": [{"project": "exact domain name from SERVICE CONTEXT", "kpi": "...", "change": "...", "before": "...", "after": "...", "note": "...", "confidence": "high|low|ambiguous"}],
  "action_items": [{"assignee": "...", "item": "...", "deadline": "MM/DD"}],
  "next_meeting": "YYYY-MM-DD (요일) HH:MM or empty string",
  "additional_notes": "any notable remarks or empty string"
}`;

async function analyzeTranscript(meeting: Meeting): Promise<MeetingAnalysis> {
  // 서비스 컨텍스트 로드 → LLM에 주입하여 정확한 도메인 귀속 유도
  const domainList = await loadDomainList();
  const serviceContext = await loadServiceContext(domainList);
  const serviceContextText = formatServiceContextForPrompt(serviceContext);
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{service_context}', serviceContextText);

  const userPrompt = USER_PROMPT_TEMPLATE.replace('{meeting_type}', meeting.meeting_type)
    .replace('{meeting_date}', meeting.meeting_date)
    .replace('{title}', meeting.title)
    .replace('{attendees}', meeting.attendees.join(', '))
    .replace('{transcript}', meeting.mapped_transcript || '');

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[];
  };

  const rawText = data.content.find((c) => c.type === 'text')?.text;
  if (!rawText) throw new Error('No text content in Anthropic response');

  // Strip markdown code block fencing if present (```json ... ```)
  const text = rawText
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  return JSON.parse(text) as MeetingAnalysis;
}

// ── Discussion Body Builder ──

function buildDiscussionBody(meeting: Meeting, analysis: MeetingAnalysis): string {
  const sections: string[] = [];

  sections.push(`### 📅 회의 일시\n\n${analysis.meeting_time}`);
  sections.push(`### 🏷️ 회의 유형\n\n${analysis.meeting_type_label}`);
  sections.push(`### 👥 참석자\n\n${meeting.attendees.join(' ')}`);
  sections.push(`### 📝 회의 안건\n\n${analysis.agenda_items}`);

  if (analysis.decisions.length > 0) {
    const decisionsText = analysis.decisions
      .map(
        (d, i) =>
          `- **결정 ${i + 1}**: ${d.content}\n  - 배경: ${d.background}\n  - 담당: ${d.assignee}`,
      )
      .join('\n\n');
    sections.push(`### ✅ 의사결정\n\n${decisionsText}`);
  }

  if (analysis.kpi_changes.length > 0) {
    const header =
      '| 프로젝트 | KPI | 변경 | 이전 | 이후 | 비고 |\n|----------|-----|------|------|------|------|';
    const rows = analysis.kpi_changes
      .map(
        (k) => `| ${k.project} | ${k.kpi} | ${k.change} | ${k.before} | ${k.after} | ${k.note} |`,
      )
      .join('\n');
    sections.push(`### 📊 KPI 변경사항\n\n${header}\n${rows}`);
  }

  if (analysis.action_items.length > 0) {
    const items = analysis.action_items
      .map((a) => `- [ ] @${a.assignee}: ${a.item} (기한: ${a.deadline})`)
      .join('\n');
    sections.push(`### 📌 액션 아이템\n\n${items}`);
  }

  if (analysis.next_meeting) {
    sections.push(`### 📅 다음 미팅\n\n${analysis.next_meeting}`);
  }

  if (analysis.additional_notes) {
    sections.push(`### 📎 추가 메모\n\n${analysis.additional_notes}`);
  }

  return sections.join('\n\n');
}

// ── KB Entry Builder ──

async function loadMemberDomainMap(): Promise<Record<string, string>> {
  const { query: dbQuery } = await import('../db');
  const result = await dbQuery<{ sub_key: string; content: string }>(
    `SELECT sub_key, content FROM semo.knowledge_base
     WHERE domain = 'semicolon' AND key = 'team' AND sub_key != ''`,
  );
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    const domain = row.sub_key;
    const firstLine = row.content.split('\n')[0];
    const nameMatch = firstLine.match(/^(.+?)\s*\((\w+)\)/);
    if (nameMatch) {
      map[nameMatch[1]] = domain;
      map[nameMatch[2]] = domain;
    }
    map[domain] = domain;
  }
  return map;
}

let _memberMapCache: Record<string, string> | null = null;

async function resolveMemberDomain(name: string): Promise<string> {
  if (!_memberMapCache) {
    _memberMapCache = await loadMemberDomainMap();
  }
  for (const [key, domain] of Object.entries(_memberMapCache)) {
    if (name.includes(key)) return domain;
  }
  return 'reus';
}

export interface KBEntry {
  domain: string;
  key: string;
  sub_key: string;
  content: string;
  type: 'decision' | 'kpi';
  action: 'create' | 'skip';
  confidence?: AttributionConfidence;
  domain_rationale?: string;
}

/** PostgreSQL DATE → yyyy-mm-dd 문자열 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10);
}

/** 도메인 목록 로드 (LLM 프롬프트용 + decision 도메인 매칭) */
async function loadDomainList(): Promise<
  { domain: string; description?: string; entity_type?: string }[]
> {
  const { listDomains } = await import('./kb');
  return listDomains();
}

// ── Service Context (서비스 귀속 판단용) ──

interface ServiceContext {
  domain: string;
  description?: string;
  baseInfo: string;
  parentDomain?: string;
}

/** 서비스 도메인별 base-information + parent 관계 로드 */
async function loadServiceContext(
  domainList: { domain: string; description?: string; entity_type?: string }[],
): Promise<ServiceContext[]> {
  const { query: dbQuery } = await import('../db');
  const serviceDomains = domainList.filter((d) => d.entity_type === 'service').map((d) => d.domain);

  if (serviceDomains.length === 0) return [];

  const [baseInfoResult, parentResult] = await Promise.all([
    dbQuery<{ domain: string; content: string }>(
      `SELECT domain, LEFT(content, 500) as content
       FROM semo.knowledge_base
       WHERE domain = ANY($1) AND key = 'base-information' AND sub_key = ''`,
      [serviceDomains],
    ),
    dbQuery<{ domain: string; metadata: Record<string, unknown> }>(
      `SELECT domain, metadata FROM semo.knowledge_base
       WHERE domain = ANY($1) AND key = 'pipeline' AND sub_key = 'config'`,
      [serviceDomains],
    ),
  ]);

  const baseInfoMap: Record<string, string> = {};
  for (const row of baseInfoResult.rows) baseInfoMap[row.domain] = row.content;

  const parentMap: Record<string, string> = {};
  for (const row of parentResult.rows) {
    const pd = row.metadata?.parent_domain as string | undefined;
    if (pd) parentMap[row.domain] = pd;
  }

  return serviceDomains
    .filter((d) => baseInfoMap[d]) // 정보가 있는 서비스만 포함
    .map((domain) => ({
      domain,
      description: domainList.find((d) => d.domain === domain)?.description,
      baseInfo: baseInfoMap[domain],
      parentDomain: parentMap[domain],
    }));
}

/** 서비스 컨텍스트를 LLM 프롬프트용 텍스트로 변환 */
function formatServiceContextForPrompt(services: ServiceContext[]): string {
  if (services.length === 0) return 'SERVICE CONTEXT:\nNo service domains available.';

  // 부모-자식 관계를 그룹핑하여 표시
  const parentGroups: Record<string, ServiceContext[]> = {};
  const standalone: ServiceContext[] = [];

  for (const svc of services) {
    if (svc.parentDomain) {
      if (!parentGroups[svc.parentDomain]) parentGroups[svc.parentDomain] = [];
      parentGroups[svc.parentDomain].push(svc);
    } else {
      standalone.push(svc);
    }
  }

  const lines: string[] = ['SERVICE CONTEXT (use these exact domain names for related_project):'];

  for (const svc of standalone) {
    const children = parentGroups[svc.domain];
    const firstLine = svc.baseInfo.split('\n')[0];
    lines.push(`- ${svc.domain}: ${firstLine}`);
    if (children) {
      lines.push(`  Sub-services of ${svc.domain} (attribute to sub-service, NOT parent):`);
      for (const child of children) {
        const childFirst = child.baseInfo.split('\n')[0];
        lines.push(`  - ${child.domain}: ${childFirst}`);
      }
    }
  }

  // 부모가 목록에 없는 자식 (예외)
  for (const [parent, children] of Object.entries(parentGroups)) {
    if (standalone.some((s) => s.domain === parent)) continue;
    lines.push(`Sub-services of ${parent}:`);
    for (const child of children) {
      const childFirst = child.baseInfo.split('\n')[0];
      lines.push(`  - ${child.domain}: ${childFirst}`);
    }
  }

  return lines.join('\n');
}

/** related_project를 온톨로지 도메인으로 매칭 */
function resolveProjectDomain(
  relatedProject: string | undefined,
  domainList: { domain: string; description?: string }[],
): string {
  if (!relatedProject) return 'semicolon';
  const lower = relatedProject.toLowerCase().replace(/\s+/g, '-');
  // 정확한 도메인 매칭
  const exact = domainList.find((d) => d.domain === lower);
  if (exact) return exact.domain;
  // 부분 매칭 (도메인이 프로젝트명을 포함하거나, description에 포함)
  const partial = domainList.find(
    (d) => d.domain.includes(lower) || (d.description ?? '').toLowerCase().includes(lower),
  );
  return partial?.domain ?? 'semicolon';
}

/** LLM 분석 결과의 서비스 귀속을 후처리 검증 */
function validateAttributions(
  analysis: MeetingAnalysis,
  domainList: { domain: string; description?: string; entity_type?: string }[],
  serviceContext: ServiceContext[],
): MeetingAnalysis {
  const validDomains = new Set(domainList.map((d) => d.domain));
  const childDomains = new Set(serviceContext.filter((s) => s.parentDomain).map((s) => s.domain));
  const parentDomains = new Set(
    serviceContext.filter((s) => s.parentDomain).map((s) => s.parentDomain!),
  );

  for (const decision of analysis.decisions) {
    const rp = decision.related_project;
    if (!rp) continue;

    const resolved = rp.toLowerCase().replace(/\s+/g, '-');

    // 1. related_project가 유효한 도메인이 아닌 경우 → low
    if (!validDomains.has(resolved) && !validDomains.has(rp)) {
      decision.confidence = 'low';
      decision.domain_rationale =
        (decision.domain_rationale ?? '') +
        ` [검증] "${rp}"은(는) 등록된 도메인이 아닙니다. 가장 유사한 도메인을 확인하세요.`;
    }

    // 2. 부모 도메인으로 귀속되었으나 하위 서비스가 존재 → low
    if (parentDomains.has(resolved) && decision.confidence !== 'ambiguous') {
      decision.confidence = decision.confidence === 'low' ? 'low' : 'low';
      decision.domain_rationale =
        (decision.domain_rationale ?? '') +
        ` [검증] "${rp}"은(는) 상위 플랫폼입니다. 하위 서비스(${[...childDomains].filter((c) => serviceContext.find((s) => s.domain === c)?.parentDomain === resolved).join(', ')}) 중 정확한 귀속을 확인하세요.`;
    }
  }

  // KPI 도메인 검증
  for (const kpi of analysis.kpi_changes) {
    const resolved = kpi.project.toLowerCase().replace(/\s+/g, '-');
    if (!validDomains.has(resolved)) {
      kpi.confidence = 'low';
    }
    if (parentDomains.has(resolved)) {
      kpi.confidence = kpi.confidence === 'ambiguous' ? 'ambiguous' : 'low';
    }
  }

  return analysis;
}

async function buildKBEntries(analysis: MeetingAnalysis, meeting: Meeting): Promise<KBEntry[]> {
  const entries: KBEntry[] = [];
  const date = formatDate(meeting.meeting_date);
  const domainList = await loadDomainList();

  // Decisions — grouped by domain, sub_key는 날짜만
  const decisionsByDomain: Record<string, typeof analysis.decisions> = {};
  for (const decision of analysis.decisions) {
    const domain = resolveProjectDomain(decision.related_project, domainList);
    if (!decisionsByDomain[domain]) decisionsByDomain[domain] = [];
    decisionsByDomain[domain].push(decision);
  }
  for (const [domain, decisions] of Object.entries(decisionsByDomain)) {
    const content = decisions
      .map((d, i) => {
        const prefix = decisions.length > 1 ? `## 결정 ${i + 1}: ${d.title}` : `## ${d.title}`;
        return `${prefix}\n\n### 배경\n${d.background}\n\n### 결정\n${d.content}\n\n### 담당\n${d.assignee}`;
      })
      .join('\n\n---\n\n');

    // 그룹 내 가장 낮은 confidence를 KB 항목에 전파
    const lowestConfidence = decisions.reduce<AttributionConfidence | undefined>((worst, d) => {
      if (!d.confidence || d.confidence === 'high') return worst;
      if (d.confidence === 'ambiguous') return 'ambiguous';
      if (d.confidence === 'low') return worst === 'ambiguous' ? 'ambiguous' : 'low';
      return worst;
    }, undefined);
    const rationales = decisions
      .map((d) => d.domain_rationale)
      .filter(Boolean)
      .join('; ');

    entries.push({
      domain,
      key: 'decision',
      sub_key: date,
      content,
      type: 'decision',
      action: 'create',
      confidence: lowestConfidence,
      domain_rationale: rationales || undefined,
    });
  }

  // Action items are now stored in DB directly (see generateMeetingNotes)
  // They are not part of KB entries anymore.

  // KPI changes (grouped by project)
  const byProject: Record<string, typeof analysis.kpi_changes> = {};
  for (const k of analysis.kpi_changes) {
    if (!byProject[k.project]) byProject[k.project] = [];
    byProject[k.project].push(k);
  }
  for (const [project, items] of Object.entries(byProject)) {
    const domain = resolveProjectDomain(project, domainList);
    const header = '| KPI | 변경 | 이전 | 이후 | 비고 |\n|-----|------|------|------|------|';
    const rows = items
      .map((k) => `| ${k.kpi} | ${k.change} | ${k.before} | ${k.after} | ${k.note} |`)
      .join('\n');
    const lowestKpiConfidence = items.reduce<AttributionConfidence | undefined>((worst, k) => {
      if (!k.confidence || k.confidence === 'high') return worst;
      if (k.confidence === 'ambiguous') return 'ambiguous';
      return worst === 'ambiguous' ? 'ambiguous' : 'low';
    }, undefined);
    entries.push({
      domain,
      key: 'kpi',
      sub_key: date,
      content: `## ${project} KPI (${date})\n\n${header}\n${rows}`,
      type: 'kpi',
      action: 'create',
      confidence: lowestKpiConfidence,
    });
  }

  return entries;
}

// ── Preview (Dry-Run) ──

export interface PreviewResult {
  discussion: { title: string; body: string };
  kbEntries: KBEntry[];
  analysis: MeetingAnalysis;
}

export async function previewMeetingNotes(meeting: Meeting): Promise<PreviewResult> {
  if (!meeting.mapped_transcript) {
    throw new Error('Meeting has no mapped transcript. Complete speaker mapping first.');
  }

  const domainList = await loadDomainList();
  const serviceContext = await loadServiceContext(domainList);

  let analysis = await analyzeTranscript(meeting);
  analysis = validateAttributions(analysis, domainList, serviceContext);

  const body = buildDiscussionBody(meeting, analysis);
  const kbEntries = await buildKBEntries(analysis, meeting);

  return {
    discussion: { title: meeting.title, body },
    kbEntries,
    analysis,
  };
}

// ── Generate (Commit) ──

export interface ActionItemInput {
  assignee: string;
  item: string;
  deadline: string;
}

export interface EditedGenerationInput {
  discussion: { title: string; body: string };
  kbEntries: KBEntry[];
  actionItems?: ActionItemInput[];
}

export interface GenerationResult {
  discussionUrl: string;
  discussionNumber: number;
  result: { decisions: number; actions: number; kpi: number };
}

async function sendSlackNotification(
  title: string,
  discussionUrl: string,
  notionUrl?: string | null,
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('SLACK_BOT_TOKEN not set, skipping notification');
    return;
  }

  let channelId: string | null = null;
  try {
    const kb = await import('../db').then((db) =>
      db.query<{ content: string }>(
        `SELECT content FROM semo.knowledge_base WHERE domain = 'semicolon' AND key = 'team' AND sub_key = 'slack-channels' LIMIT 1`,
      ),
    );
    if (kb.rows.length > 0) {
      const match = kb.rows[0].content.match(/개발사업팀[^C]*?(C[A-Z0-9]+)/);
      if (match) channelId = match[1];
    }
  } catch {
    /* KB unavailable */
  }

  if (!channelId) {
    console.warn('Could not resolve 개발사업팀 channel ID, skipping Slack');
    return;
  }

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      text: `📝 회의록 생성 완료\n*제목*: ${title}\n*GitHub*: ${discussionUrl}${notionUrl ? `\n*Notion*: ${notionUrl}` : ''}`,
    }),
  });
}

// ── Transcript KB Storage ──

/** 회의 녹취록의 도메인별 요약을 KB session/meeting/* 엔트리로 저장 */
async function storeTranscriptInKB(
  meeting: Meeting,
  kbEntries: KBEntry[],
  discussionUrl: string,
): Promise<void> {
  const domains = [...new Set(kbEntries.filter((e) => e.action === 'create').map((e) => e.domain))];
  if (domains.length === 0) return;

  const date = formatDate(meeting.meeting_date);
  const attendees = meeting.attendees.join(', ');

  for (const domain of domains) {
    const domainEntries = kbEntries.filter((e) => e.domain === domain && e.action === 'create');
    const decisionSummary = domainEntries
      .filter((e) => e.type === 'decision')
      .map((e) => e.content.split('\n').slice(0, 3).join('\n'))
      .join('\n');
    const kpiSummary = domainEntries
      .filter((e) => e.type === 'kpi')
      .map((e) => e.content)
      .join('\n');

    const sections: string[] = [`## ${meeting.title} (${date})`, `참석자: ${attendees}`];
    if (decisionSummary) sections.push(`### 관련 의사결정\n${decisionSummary}`);
    if (kpiSummary) sections.push(`### KPI 변경\n${kpiSummary}`);
    sections.push(`\n전체 회의록: [Discussion](${discussionUrl})`);

    const content = sections.join('\n\n');
    const kbKey = `session/meeting/${meeting.meeting_id}`;

    try {
      await upsertItem(domain, kbKey, content, 'dashboard-meeting');
    } catch (err) {
      console.warn(`[meeting-generate] Transcript KB store failed for ${domain}/${kbKey}:`, err);
    }
  }
}

export async function generateMeetingNotes(
  meeting: Meeting,
  editedData?: EditedGenerationInput,
): Promise<GenerationResult> {
  let title: string;
  let body: string;
  let kbEntries: KBEntry[];
  let actionItemInputs: ActionItemInput[] = [];
  let analysis: MeetingAnalysis | null = null;

  if (editedData) {
    // Use user-edited data
    title = editedData.discussion.title;
    body = editedData.discussion.body;
    kbEntries = editedData.kbEntries;
    actionItemInputs = editedData.actionItems ?? [];
    // Reconstruct a minimal analysis from edited data for Notion sync
    analysis = {
      meeting_time: meeting.meeting_date,
      meeting_type_label: meeting.meeting_type === 'regular' ? '정기 회고&회의' : '임시회의',
      agenda_items: '',
      decisions: kbEntries
        .filter((e) => e.type === 'decision')
        .map((e) => ({
          title: e.sub_key,
          content: e.content,
          background: '',
          assignee: '',
          related_project: '',
        })),
      kpi_changes: [],
      action_items: actionItemInputs.map((a) => ({
        assignee: a.assignee,
        item: a.item,
        deadline: a.deadline,
      })),
      next_meeting: '',
      additional_notes: '',
    };
  } else {
    // Auto-generate (legacy path)
    if (!meeting.mapped_transcript) {
      throw new Error('Meeting has no mapped transcript.');
    }
    const preview = await previewMeetingNotes(meeting);
    title = preview.discussion.title;
    body = preview.discussion.body;
    kbEntries = preview.kbEntries;
    actionItemInputs = preview.analysis.action_items;
    analysis = preview.analysis;
  }

  // 1. Create GitHub Discussion
  const discussion = await createMeetingDiscussion(title, body);

  // 2. Write KB entries (only those with action: 'create')
  let decisions = 0,
    kpi = 0;
  for (const entry of kbEntries) {
    if (entry.action === 'skip') continue;
    const dateStr = formatDate(meeting.meeting_date);
    const kbKey = entry.sub_key ? `${entry.key}/${entry.sub_key}` : entry.key;
    const contentWithSource = `${entry.content}\n\n출처: [회의록](${discussion.url}) (${dateStr})`;
    try {
      await upsertItem(entry.domain, kbKey, contentWithSource, 'dashboard-meeting');
      if (entry.type === 'decision') decisions++;
      else if (entry.type === 'kpi') kpi++;
    } catch (err) {
      console.warn(`KB write failed for ${entry.domain}/${kbKey}:`, err);
    }
  }

  // 2b. Write action items to DB (SoT = action_items table)
  let actions = 0;
  if (actionItemInputs.length > 0) {
    const { createActionItem } = await import('../service');
    for (const item of actionItemInputs) {
      try {
        const ownerDomain = await resolveMemberDomain(item.assignee);
        await createActionItem({
          owner_domain: ownerDomain,
          description: item.item,
          assignee: item.assignee,
          deadline: item.deadline,
          source: 'meeting',
          related_url: discussion.url,
        });
        actions++;
      } catch (err) {
        console.warn(`Action item DB write failed for "${item.item}":`, err);
      }
    }
  }

  // 2c. Store transcript summaries in KB per domain (non-blocking)
  await storeTranscriptInKB(meeting, kbEntries, discussion.url).catch((err) => {
    console.warn('[meeting-generate] Transcript KB storage failed (non-blocking):', err);
  });

  // 3. Notion sync (non-blocking)
  let notionUrl: string | null = null;
  try {
    const notionResult = analysis
      ? await syncMeetingToNotion(meeting, analysis, discussion.url)
      : null;
    if (notionResult) {
      await updateNotionSync(meeting.meeting_id, notionResult);
      notionUrl = notionResult.url;
    }
  } catch (err) {
    console.warn('[meeting-generate] Notion sync failed (non-blocking):', err);
    await updateNotionSync(
      meeting.meeting_id,
      null,
      err instanceof Error ? err.message : String(err),
    ).catch(() => {});
  }

  // 4. Slack notification
  await sendSlackNotification(title, discussion.url, notionUrl).catch((err) => {
    console.warn('Slack notification failed:', err);
  });

  return {
    discussionUrl: discussion.url,
    discussionNumber: discussion.number,
    result: { decisions, actions, kpi },
  };
}
