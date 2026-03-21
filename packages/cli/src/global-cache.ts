/**
 * global-cache — DB → ~/.claude/{skills,commands,agents} 동기화
 *
 * SessionStart 훅과 `semo context sync`에서 호출.
 * 기존 디렉토리를 전체 교체(full replace)하며, DB 실패 시 기존 파일 유지.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import {
  getActiveSkills,
  getCommands,
  getAgents,
  getDelegations,
  Skill,
  SemoCommand,
  Agent,
  BotDelegation,
} from "./database";

export interface GlobalCacheSyncResult {
  skills: number;
  commands: number;
  agents: number;
}

const isWindows = process.platform === "win32";

function removeRecursive(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return;

  if (isWindows) {
    try {
      const stats = fs.lstatSync(targetPath);
      if (stats.isSymbolicLink()) {
        execSync(`cmd /c "rmdir "${targetPath}""`, { stdio: "pipe" });
      } else {
        execSync(`cmd /c "rd /s /q "${targetPath}""`, { stdio: "pipe" });
      }
    } catch {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  } else {
    execSync(`rm -rf "${targetPath}"`, { stdio: "pipe" });
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
          content.slice(0, lineEnd) +
          `\n  Agents: ${botIds.join(', ')}` +
          content.slice(lineEnd)
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
  claudeDir?: string
): Promise<GlobalCacheSyncResult> {
  const dir = claudeDir || path.join(os.homedir(), ".claude");
  fs.mkdirSync(dir, { recursive: true });

  // 병렬 조회
  const [skills, commands, agents, delegations] = await Promise.all([
    getActiveSkills(),
    getCommands(),
    getAgents(),
    getDelegations(),
  ]);

  // 1. 스킬 설치 (전체 교체)
  const skillsDir = path.join(dir, "skills");
  removeRecursive(skillsDir);
  fs.mkdirSync(skillsDir, { recursive: true });

  let skippedSkills = 0;
  for (const skill of skills) {
    if (skill.name.includes('/')) {
      console.warn(`⚠️ 스킬 이름에 슬래시 포함 — 스킵: ${skill.name}`);
      skippedSkills++;
      continue;
    }
    const skillFolder = path.join(skillsDir, skill.name);
    fs.mkdirSync(skillFolder, { recursive: true });
    const finalContent = injectAgentInfo(skill.content, skill.bot_ids);
    fs.writeFileSync(path.join(skillFolder, "SKILL.md"), finalContent);
  }

  // 2. 커맨드 설치 (전체 교체)
  const commandsDir = path.join(dir, "commands");
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

  // 3. 에이전트 설치 (전체 교체, 대소문자 중복 제거)
  const agentsDir = path.join(dir, "agents");
  removeRecursive(agentsDir);
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

  for (const agent of dedupedAgents) {
    const agentFolder = path.join(agentsDir, agent.name);
    fs.mkdirSync(agentFolder, { recursive: true });

    let content = agent.content;

    // 위임 매트릭스 주입
    const agentDelegations = delegations.filter(
      (d) => d.from_bot_id === agent.name
    );
    if (agentDelegations.length > 0) {
      const delegationLines = agentDelegations
        .map(
          (d) =>
            `- → ${d.to_bot_id}: ${d.domains.join(", ")} (via ${d.method})`
        )
        .join("\n");
      content += `\n\n## 위임 매트릭스\n${delegationLines}\n`;
    }

    fs.writeFileSync(path.join(agentFolder, `${agent.name}.md`), content);
  }

  return {
    skills: skills.length - skippedSkills,
    commands: cmdCount,
    agents: dedupedAgents.length,
  };
}
