/**
 * global-cache — DB → ~/.claude/{skills,commands,agents} 동기화
 *
 * SessionStart 훅과 `semo context sync`에서 호출.
 * 기존 디렉토리를 전체 교체(full replace)하며, DB 실패 시 기존 파일 유지.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  getActiveSkills,
  getCommands,
  getAgents,
  getDelegations,
  Skill,
  SemoCommand,
  Agent,
  BotDelegation,
} from './database';
import { tenantDir, ensureSemoLayout } from './paths.js';

export interface GlobalCacheSyncResult {
  skills: number;
  commands: number;
  agents: number;
  tenantOverlays?: number;
}

/**
 * tenant/ 영역의 파일을 merged (= ~/.claude/) 에 오버레이한다.
 * - tenant/skills/{name}/       → 스킬 통째 덮어씀 (tenant 승리)
 * - tenant/commands/{folder}/{name}.md → 파일 단위 덮어씀
 * - tenant/agents/{name}/{name}.md     → 에이전트 통째 덮어씀
 *
 * 재귀 복사는 Node fs.cpSync(recursive) 를 사용. 실패는 경고만 남기고 계속 진행.
 */
export function applyTenantOverlay(mergedDir: string, tenantRoot: string): number {
  let overlaid = 0;
  const sections: Array<{ name: 'skills' | 'commands' | 'agents'; perEntry: boolean }> = [
    { name: 'skills', perEntry: true },
    { name: 'commands', perEntry: false },
    { name: 'agents', perEntry: true },
  ];

  for (const section of sections) {
    const srcRoot = path.join(tenantRoot, section.name);
    const dstRoot = path.join(mergedDir, section.name);
    if (!fs.existsSync(srcRoot)) continue;
    fs.mkdirSync(dstRoot, { recursive: true });

    if (section.perEntry) {
      const entries = fs.readdirSync(srcRoot, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const src = path.join(srcRoot, ent.name);
        const dst = path.join(dstRoot, ent.name);
        try {
          if (fs.existsSync(dst)) removeRecursive(dst);
          fs.cpSync(src, dst, { recursive: true });
          overlaid++;
        } catch (err) {
          console.warn(
            `⚠️ tenant overlay 실패 (${section.name}/${ent.name}): ${(err as Error).message}`,
          );
        }
      }
    } else {
      // commands: folder/name.md 평탄화 복사
      const folders = fs.readdirSync(srcRoot, { withFileTypes: true });
      for (const folder of folders) {
        if (!folder.isDirectory()) continue;
        const srcFolder = path.join(srcRoot, folder.name);
        const dstFolder = path.join(dstRoot, folder.name);
        fs.mkdirSync(dstFolder, { recursive: true });
        const files = fs.readdirSync(srcFolder);
        for (const f of files) {
          if (!f.endsWith('.md')) continue;
          try {
            fs.cpSync(path.join(srcFolder, f), path.join(dstFolder, f));
            overlaid++;
          } catch (err) {
            console.warn(
              `⚠️ tenant overlay 실패 (commands/${folder.name}/${f}): ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }
  return overlaid;
}

const isWindows = process.platform === 'win32';

function removeRecursive(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return;

  if (isWindows) {
    try {
      const stats = fs.lstatSync(targetPath);
      if (stats.isSymbolicLink()) {
        execSync(`cmd /c "rmdir "${targetPath}""`, { stdio: 'pipe' });
      } else {
        execSync(`cmd /c "rd /s /q "${targetPath}""`, { stdio: 'pipe' });
      }
    } catch {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  } else {
    execSync(`rm -rf "${targetPath}"`, { stdio: 'pipe' });
  }
}

/**
 * DB에서 스킬/커맨드/에이전트를 조회하여 ~/.claude/ 하위에 파일로 캐싱.
 *
 * - 병렬 조회 후 기존 디렉토리 삭제 → 재생성 → 파일 쓰기 (full replace)
 * - DB 실패 시 기존 파일 유지 (비치명적 에러)
 * - 콘솔 출력 없음 (caller가 처리)
 */
/**
 * SKILL.md content에 대상 에이전트(봇) 정보를 주입
 */
function injectAgentInfo(content: string, botIds: string[]): string {
  if (!botIds || botIds.length === 0) return content;

  const agentLine = `\n> **Agents:** ${botIds.join(', ')}\n`;

  // frontmatter에 description이 있으면 그 줄 바로 뒤에 Agents 삽입
  const fmEnd = content.indexOf('\n---', 4); // 첫 번째 --- 이후의 ---
  if (content.startsWith('---\n') && fmEnd !== -1) {
    const fm = content.slice(4, fmEnd);
    const descIdx = fm.indexOf('description:');
    if (descIdx !== -1) {
      const absDescStart = 4 + descIdx;
      const lineEnd = content.indexOf('\n', absDescStart);
      if (lineEnd !== -1) {
        return (
          content.slice(0, lineEnd) + `\n  Agents: ${botIds.join(', ')}` + content.slice(lineEnd)
        );
      }
    }
  }

  // fallback: 첫 번째 빈 줄 뒤에 blockquote로 삽입
  const firstBlank = content.indexOf('\n\n');
  if (firstBlank !== -1) {
    return content.slice(0, firstBlank) + agentLine + content.slice(firstBlank);
  }
  return content + agentLine;
}

export async function syncGlobalCache(
  claudeDir?: string,
  options?: { officeId?: string | null },
): Promise<GlobalCacheSyncResult> {
  const dir = claudeDir || path.join(os.homedir(), '.claude');
  fs.mkdirSync(dir, { recursive: true });

  // tenant L2 override: 명시적 옵션 → env → null (L0만)
  const officeId = options?.officeId ?? process.env.SEMO_OFFICE_ID ?? null;

  // 병렬 조회
  const [skills, commands, agents, delegations] = await Promise.all([
    getActiveSkills(officeId),
    getCommands(officeId),
    getAgents(officeId),
    getDelegations(),
  ]);

  // 1. 스킬 설치 (전체 교체)
  const skillsDir = path.join(dir, 'skills');
  removeRecursive(skillsDir);
  fs.mkdirSync(skillsDir, { recursive: true });

  let skippedSkills = 0;
  for (const skill of skills) {
    if (skill.name.includes('/')) {
      console.warn(`⚠️ 스킬 이름에 슬래시 포함 — 스킵: ${skill.name}`);
      skippedSkills++;
      continue;
    }
    if (!skill.content) continue; // skip skills with null/empty content
    const skillFolder = path.join(skillsDir, skill.name);
    fs.mkdirSync(skillFolder, { recursive: true });
    const finalContent = injectAgentInfo(skill.content, skill.bot_ids);
    fs.writeFileSync(path.join(skillFolder, 'SKILL.md'), finalContent);

    // Write reference files if present
    if (
      skill.reference_files &&
      typeof skill.reference_files === 'object' &&
      Object.keys(skill.reference_files).length > 0
    ) {
      const refsDir = path.join(skillFolder, 'references');
      fs.mkdirSync(refsDir, { recursive: true });
      for (const [filename, refContent] of Object.entries(skill.reference_files)) {
        if (typeof refContent === 'string') {
          fs.writeFileSync(path.join(refsDir, filename), refContent);
        }
      }
    }
  }

  // 2. 커맨드 설치 (전체 교체)
  const commandsDir = path.join(dir, 'commands');
  removeRecursive(commandsDir);
  fs.mkdirSync(commandsDir, { recursive: true });

  const commandsByFolder: Record<string, SemoCommand[]> = {};
  for (const cmd of commands) {
    if (!commandsByFolder[cmd.folder]) {
      commandsByFolder[cmd.folder] = [];
    }
    commandsByFolder[cmd.folder].push(cmd);
  }

  let cmdCount = 0;
  for (const [folder, cmds] of Object.entries(commandsByFolder)) {
    const folderPath = path.join(commandsDir, folder);
    fs.mkdirSync(folderPath, { recursive: true });
    for (const cmd of cmds) {
      fs.writeFileSync(path.join(folderPath, `${cmd.name}.md`), cmd.content);
      cmdCount++;
    }
  }

  // 3. 에이전트 설치 (머지 모드 — 로컬 YAML frontmatter 보존)
  const agentsDir = path.join(dir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  const seenAgentNames = new Set<string>();
  const dedupedAgents: Agent[] = [];
  for (const agent of agents) {
    const lowerName = agent.name.toLowerCase();
    if (!seenAgentNames.has(lowerName)) {
      seenAgentNames.add(lowerName);
      dedupedAgents.push(agent);
    }
  }

  // 기존 로컬 파일의 frontmatter 캐싱 (덮어쓰기 전)
  const existingFrontmatters = new Map<string, string>();
  for (const folder of fs.readdirSync(agentsDir).filter((f) => !f.startsWith('.'))) {
    const filePath = path.join(agentsDir, folder, `${folder}.md`);
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf8');
      const fmMatch = existing.match(/^---\n([\s\S]*?)\n---\n/);
      if (fmMatch) {
        existingFrontmatters.set(folder.toLowerCase(), fmMatch[1]);
      }
    }
  }

  // DB에 없는 에이전트 폴더 정리 (orphan 제거)
  const dbAgentNames = new Set(dedupedAgents.map((a) => a.name.toLowerCase()));
  for (const folder of fs.readdirSync(agentsDir).filter((f) => !f.startsWith('.'))) {
    const folderPath = path.join(agentsDir, folder);
    if (!dbAgentNames.has(folder.toLowerCase()) && fs.statSync(folderPath).isDirectory()) {
      removeRecursive(folderPath);
    }
  }

  for (const agent of dedupedAgents) {
    const agentFolder = path.join(agentsDir, agent.name);
    fs.mkdirSync(agentFolder, { recursive: true });

    // DB content에서 frontmatter 제거 (body만 추출)
    let dbBody = agent.content;
    const dbFmMatch = agent.content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    if (dbFmMatch) {
      dbBody = dbFmMatch[1].trim();
    }

    // 위임 매트릭스 주입
    const agentDelegations = delegations.filter((d) => d.from_bot_id === agent.name);
    if (agentDelegations.length > 0) {
      const delegationLines = agentDelegations
        .map((d) => `- → ${d.to_bot_id}: ${d.domains.join(', ')} (via ${d.method})`)
        .join('\n');
      dbBody += `\n\n## 위임 매트릭스\n${delegationLines}\n`;
    }

    // 로컬 frontmatter 보존 (있으면) → DB body와 합침
    const localFm = existingFrontmatters.get(agent.name.toLowerCase());
    let content: string;
    if (localFm) {
      // 로컬 frontmatter 우선 보존 + DB body 업데이트
      content = `---\n${localFm}\n---\n${dbBody}`;
    } else if (agent.metadata && (agent.metadata.model || agent.metadata.description)) {
      // 로컬 frontmatter 없으면 metadata에서 생성
      const fm = ['---'];
      if (agent.metadata.description) fm.push(`description: "${agent.metadata.description}"`);
      if (agent.metadata.model) fm.push(`model: "${agent.metadata.model}"`);
      fm.push('---', '');
      content = fm.join('\n') + dbBody;
    } else {
      content = dbBody;
    }

    fs.writeFileSync(path.join(agentFolder, `${agent.name}.md`), content);
  }

  // 4. Tenant overlay — ~/.semo/tenant/* 가 kernel(DB) 산출물을 덮어쓴다.
  // SEMO_TENANT_OVERLAY=off 로 일시 비활성화 가능 (디버깅/롤백용).
  let tenantOverlays = 0;
  if (process.env.SEMO_TENANT_OVERLAY !== 'off') {
    ensureSemoLayout();
    tenantOverlays = applyTenantOverlay(dir, tenantDir());
  }

  return {
    skills: skills.length - skippedSkills,
    commands: cmdCount,
    agents: dedupedAgents.length,
    tenantOverlays,
  };
}
