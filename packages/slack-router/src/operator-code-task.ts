/**
 * operator-code-task — operator(슬랙 관리채널)가 코드 변경을 요청할 때의 순수 로직.
 *
 * Operator hermes 는 도구가 없다. 코드 변경이 필요하다고 판단하면 응답에
 * APPLY_CODE_TASK 블록을 출력하고, 라우터가 이를 파싱해 headless 코딩 에이전트에 위임한다.
 * (실제 위임/PR 은 operator-code-dispatch.ts. 본 파일은 파싱·경계검사·프롬프트 등 순수 함수만.)
 *
 * 설계: docs/superpowers/specs/2026-06-03-operator-code-change-capability-design.md
 */

export interface ParsedCodeTask {
  /** 대상 식별 라벨 (semi|colony|router ...). 브랜치/라벨에 쓰임. */
  slug: string;
  /** PR 제목. */
  title: string;
  /** 변경 사유(한두 줄). */
  rationale?: string;
  /** 손댈 것으로 예상되는 경로 힌트. */
  paths: string[];
  /** 코딩 에이전트에게 줄 상세 지시 + 수용 기준. */
  task: string;
}

/**
 * operator 출력에서 코드 변경 지시 블록을 파싱.
 * 형식:
 *   APPLY_CODE_TASK: <slug>
 *   TITLE: <PR 제목 한 줄>
 *   RATIONALE: <왜 — 한두 줄>
 *   PATHS: a/b.ts, c/d.ts
 *   ---TASK---
 *   <상세 지시 + 수용 기준>
 *   ---END---
 * TITLE 없으면 slug 기반 fallback. task 본문이 비면 null.
 */
export function parseApplyCodeTask(text: string): ParsedCodeTask | null {
  const m = text.match(
    /APPLY_CODE_TASK:\s*([a-z0-9_-]+)[^\n]*\n([\s\S]*?)---TASK---\s*\n([\s\S]*?)\n\s*---END---/i,
  );
  if (!m) return null;
  const slug = m[1].trim();
  const header = m[2];
  const task = m[3].trim();
  if (!task) return null;

  const titleM = header.match(/TITLE:\s*(.+)/i);
  const title = titleM ? titleM[1].trim() : `operator: ${slug} code change`;
  const ratM = header.match(/RATIONALE:\s*(.+)/i);
  const rationale = ratM ? ratM[1].trim() : undefined;
  const pathsM = header.match(/PATHS:\s*(.+)/i);
  const paths = pathsM
    ? pathsM[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return { slug, title, rationale, paths, task };
}

const GLOB_ESCAPE = new Set('.+^${}()|[]\\'.split(''));

/**
 * glob(`**`, `*`, `**\/`) 패턴을 anchored 정규식으로 변환. 의존성 없이 경로 매칭만 지원.
 * 문자 단위 파서(센티넬 문자열 미사용).
 */
function globToRegex(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          out += '(?:.*/)?'; // `**/` → 0개 이상 디렉토리
          i += 2;
        } else {
          out += '.*'; // `**` → 임의(슬래시 포함)
          i += 1;
        }
      } else {
        out += '[^/]*'; // `*` → 슬래시 제외
      }
    } else if (GLOB_ESCAPE.has(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}

export interface AllowlistResult {
  ok: boolean;
  offending: string[];
}

/**
 * 변경 파일 목록을 allow/deny 패턴으로 검사. deny 가 allow 보다 우선.
 * - deny 에 1개라도 매치 → offending
 * - allow 에 아무것도 매치 안 됨 → offending
 * - 빈 목록 → ok=false (빈 PR 방지)
 */
export function checkPathsAgainstAllowlist(
  changed: string[],
  allow: string[],
  deny: string[],
): AllowlistResult {
  if (changed.length === 0) return { ok: false, offending: [] };
  const denyRe = deny.map(globToRegex);
  const allowRe = allow.map(globToRegex);
  const offending = changed.filter((f) => {
    if (denyRe.some((r) => r.test(f))) return true;
    return !allowRe.some((r) => r.test(f));
  });
  return { ok: offending.length === 0, offending };
}

/** auto-merge 가능 경로 — Semi/Colony 행동 코드. */
export const DEFAULT_ALLOWLIST: string[] = [
  'packages/slack-router/src/**',
  'packages/slack-router/personas/**',
  'packages/common/src/runtime/adapters/hermes-cli-adapter.ts',
];

/** deny — allow 보다 우선. 자기-가드 및 고위험(항상 사람 리뷰). */
export const DEFAULT_DENYLIST: string[] = [
  '**/operator-code-task.ts',
  '**/operator-code-dispatch.ts',
  '**/operator-persona.ts',
  '.github/workflows/**',
  '**/migrations/**',
  '**/*.sql',
  '**/.env*',
  '**/Dockerfile*',
];

/** headless 코딩 에이전트(claude -p)에 줄 제약 프롬프트. */
export function buildCodeAgentPrompt(
  task: ParsedCodeTask,
  opts: { allowlist: string[]; qualityGate: string },
): string {
  return [
    `# 코드 변경 태스크: ${task.title}`,
    task.rationale ? `이유: ${task.rationale}` : '',
    '',
    '## 지시',
    task.task,
    '',
    task.paths.length > 0 ? '## 예상 수정 경로(힌트)' : '',
    ...task.paths.map((p) => `- ${p}`),
    '',
    '## 경계 — 아래 allowlist 경로만 수정하라',
    ...opts.allowlist.map((p) => `- ${p}`),
    '경계를 벗어난 변경은 자동 머지되지 않고 사람 리뷰로 넘어간다.',
    '',
    '## 완료 전 필수',
    `- Quality Gate 통과: ${opts.qualityGate}`,
    '- 변경에 대한 테스트를 TDD(테스트 먼저)로 작성',
    '- 끝나면 브랜치에 커밋',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** operator hermes 프롬프트에 주입: 코드 변경이 필요하면 APPLY_CODE_TASK 를 써라. */
export function buildOperatorCodeGuide(): string {
  return [
    '# 코드 변경 권한 (SOUL 로 해결 안 되는 경우)',
    'SOUL(행동 정의) 수정으로 고칠 수 없는 문제(라우터/오케스트레이터 코드 버그 등)는',
    '코딩 에이전트에 위임할 수 있습니다. 사용자 컨펌 후 아래 블록을 출력하세요.',
    '',
    '형식:',
    '```',
    'APPLY_CODE_TASK: <slug>   # semi|colony|router 등 대상 라벨',
    'TITLE: <PR 제목 한 줄>',
    'RATIONALE: <왜 — 한두 줄>',
    'PATHS: <예상 수정 경로, 쉼표구분>',
    '---TASK---',
    '<코딩 에이전트에게 줄 상세 지시 + 수용 기준>',
    '---END---',
    '```',
    '',
    '규칙:',
    '- 코드 변경은 Semi/Colony 관련 경로만 자동 머지됩니다. 그 외엔 사람 리뷰로 넘어갑니다.',
    '- 행동(말투/역할)만 바꾸면 되는 일은 코드가 아니라 APPLY_PERSONA 를 쓰세요.',
    '- 확신이 없으면 먼저 제안만 하고 컨펌을 받으세요.',
  ].join('\n');
}
