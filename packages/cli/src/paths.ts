/**
 * SEMO 파일 레이아웃 — 3-layer (kernel / tenant / merged)
 *
 * 설계 근거:
 *   L0 Core (세미콜론 팀 소유, OSS)    → kernel/      (RO, npm 설치 산출물)
 *   L2 Tenant (고객 소유, 커스텀)      → tenant/      (RW, 고객 수정 영역)
 *   세션이 실제로 읽는 위치           → merged/      (kernel + tenant 합성)
 *
 * 현 MVP 단계:
 *   - merged/ 는 `~/.claude/{skills,commands,agents}/` 로 투영 (별도 복사 없음)
 *   - 즉 sync 단계에서 kernel(DB) → 기본 파일, tenant → 덮어쓰기 오버레이
 *
 * 환경변수 오버라이드:
 *   SEMO_HOME   — 기본 ~/.semo
 *   CLAUDE_HOME — 기본 ~/.claude   (merged 출력 대상)
 */
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export function semoHome(): string {
  // SEMO→semicolony 호환: SEMICOLONY_HOME > SEMO_HOME > ~/.semo (Phase 0 default 불변).
  return process.env.SEMICOLONY_HOME || process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
}

export function claudeHome(): string {
  return process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');
}

export function kernelDir(): string {
  return path.join(semoHome(), 'kernel');
}

export function tenantDir(): string {
  return path.join(semoHome(), 'tenant');
}

export function mergedClaudeDir(): string {
  return claudeHome();
}

export const SEMO_WORKSPACES = path.join(semoHome(), 'workspaces');

export function resolveBotWorkspace(botId: string): string {
  return path.join(SEMO_WORKSPACES, botId);
}

const TENANT_README = `# SEMO Tenant Overlay

이 디렉터리는 고객(당신) 소유의 커스텀 파일 영역입니다.
kernel/ 의 파일을 같은 이름으로 여기 두면 sync 시 kernel 을 덮어씁니다.

구조:
  skills/{name}/SKILL.md    — kernel 스킬 override 또는 신규 스킬
  commands/{folder}/{name}.md
  agents/{name}/{name}.md

특이사항:
  - \`semo update\` 는 이 디렉터리를 건드리지 않습니다.
  - kernel/ 은 npm 업데이트로 교체되므로 수정하면 다음 update 에서 유실됩니다.
  - 커스텀이 필요하면 반드시 tenant/ 에 복사본을 두세요.
`;

/**
 * 3-layer 디렉터리 구조를 확보한다 (없으면 생성, 있으면 no-op).
 * - kernel/ : npm 설치 영역. 이 함수는 최소한의 빈 구조만 만들고 실제 콘텐츠는 update 명령이 채운다.
 * - tenant/ : 사용자 영역. 최초 생성 시 README 삽입.
 * - merged/ = ~/.claude/ : Claude Code 가 읽는 경로. 여기서는 존재만 보장.
 */
export function ensureSemoLayout(): { created: string[] } {
  const created: string[] = [];
  const targets: Array<[string, boolean]> = [
    [semoHome(), false],
    [kernelDir(), false],
    [path.join(kernelDir(), 'skills'), false],
    [path.join(kernelDir(), 'commands'), false],
    [path.join(kernelDir(), 'agents'), false],
    [tenantDir(), true],
    [path.join(tenantDir(), 'skills'), false],
    [path.join(tenantDir(), 'commands'), false],
    [path.join(tenantDir(), 'agents'), false],
    [mergedClaudeDir(), false],
  ];
  for (const [dir, placeReadme] of targets) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      created.push(dir);
    }
    if (placeReadme) {
      const readmePath = path.join(dir, 'README.md');
      if (!fs.existsSync(readmePath)) {
        fs.writeFileSync(readmePath, TENANT_README);
      }
    }
  }
  return { created };
}
