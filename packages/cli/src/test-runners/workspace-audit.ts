/**
 * Declarative Workspace Audit Runner
 *
 * bot_workspace_standard 테이블에서 규칙을 로드하고,
 * bot_status에서 봇 목록을 가져와 동적으로 TC를 생성·실행.
 *
 * 로컬 스크립트 의존성 없음 — DB가 SoT.
 */

import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveBotWorkspace } from '../paths';

// ============================================================
// Types
// ============================================================

interface WorkspaceRule {
  path_pattern: string;
  entry_type: string; // 'file' | 'dir' | 'symlink' | 'glob'
  level: string; // 'required' | 'optional' | 'forbidden'
  severity: string; // 'error' | 'warn'
  category: string; // 'structure' | 'legacy' | 'hygiene'
  bot_scope: string; // 'all' | 'include' | 'exclude'
  bot_ids: string[];
  symlink_target: string | null;
  content_rules: ContentRules | null;
  description: string | null;
}

interface ContentRules {
  max_lines?: number;
  required_sections?: string[];
  required_patterns?: string[];
  forbidden_patterns?: string[];
}

export interface TestOutputLine {
  type: 'case' | 'summary';
  id?: string;
  status?: 'pass' | 'fail' | 'warn' | 'skip';
  label?: string;
  detail?: string;
}

// ============================================================
// Rule Checkers
// ============================================================

function checkExistence(fullPath: string): {
  exists: boolean;
  isSymlink: boolean;
  isDir: boolean;
} {
  try {
    const lstat = fs.lstatSync(fullPath);
    return {
      exists: true,
      isSymlink: lstat.isSymbolicLink(),
      isDir: lstat.isDirectory() || (lstat.isSymbolicLink() && fs.statSync(fullPath).isDirectory()),
    };
  } catch {
    return { exists: false, isSymlink: false, isDir: false };
  }
}

function checkGlob(wsPath: string, pattern: string): string[] {
  // Simple glob matching for common patterns
  const matches: string[] = [];

  if (pattern === '*/.git') {
    // Check subdirectories for .git
    try {
      for (const entry of fs.readdirSync(wsPath)) {
        const sub = path.join(wsPath, entry);
        if (fs.statSync(sub).isDirectory() && entry !== '.git') {
          if (fs.existsSync(path.join(sub, '.git'))) {
            matches.push(entry);
          }
        }
      }
    } catch {
      /* */
    }
  } else if (pattern === 'node_modules') {
    try {
      const find = (dir: string, depth: number) => {
        if (depth > 3) return;
        for (const entry of fs.readdirSync(dir)) {
          const full = path.join(dir, entry);
          if (entry === 'node_modules' && fs.statSync(full).isDirectory()) {
            matches.push(path.relative(wsPath, full));
          } else if (fs.statSync(full).isDirectory() && !entry.startsWith('.')) {
            find(full, depth + 1);
          }
        }
      };
      find(wsPath, 0);
    } catch {
      /* */
    }
  } else if (pattern.startsWith('*.')) {
    // Glob for file extensions in root
    const ext = pattern.slice(1); // ".ovpn", ".pem", etc.
    try {
      for (const entry of fs.readdirSync(wsPath)) {
        if (entry.endsWith(ext) && fs.statSync(path.join(wsPath, entry)).isFile()) {
          matches.push(entry);
        }
      }
    } catch {
      /* */
    }
  }

  return matches;
}

function checkSymlinkTarget(
  fullPath: string,
  expectedTarget: string | null,
): { ok: boolean; actual: string | null } {
  if (!expectedTarget) return { ok: true, actual: null };

  const resolved = expectedTarget.replace('$HOME', os.homedir());
  try {
    const actual = fs.readlinkSync(fullPath);
    return { ok: actual === resolved, actual };
  } catch {
    return { ok: false, actual: null };
  }
}

function checkContentRules(
  fullPath: string,
  rules: ContentRules,
): { passed: boolean; details: string[] } {
  const details: string[] = [];
  let allPassed = true;

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // max_lines
    if (rules.max_lines !== undefined) {
      if (lines.length > rules.max_lines) {
        details.push(`줄 수 ${lines.length} > ${rules.max_lines}`);
        allPassed = false;
      }
    }

    // required_sections (grep for headings)
    if (rules.required_sections) {
      for (const section of rules.required_sections) {
        const found = content.toLowerCase().includes(section.toLowerCase());
        if (!found) {
          details.push(`섹션 미발견: ${section}`);
          allPassed = false;
        }
      }
    }

    // required_patterns (regex)
    if (rules.required_patterns) {
      for (const pat of rules.required_patterns) {
        const regex = new RegExp(pat, 'i');
        if (!regex.test(content)) {
          details.push(`패턴 미발견: ${pat}`);
          allPassed = false;
        }
      }
    }

    // forbidden_patterns (should NOT match)
    if (rules.forbidden_patterns) {
      for (const pat of rules.forbidden_patterns) {
        const regex = new RegExp(pat);
        if (regex.test(content)) {
          details.push(`금지 패턴 탐지: ${pat}`);
          allPassed = false;
        }
      }
    }
  } catch {
    details.push('파일 읽기 실패');
    allPassed = false;
  }

  return { passed: allPassed, details };
}

// ============================================================
// Main Runner
// ============================================================

function checkRule(wsPath: string, botId: string, rule: WorkspaceRule): TestOutputLine[] {
  const results: TestOutputLine[] = [];
  const label = (msg: string) => `${botId}/${rule.path_pattern}: ${msg}`;
  const caseId = `${botId}/${rule.path_pattern}`;

  if (rule.entry_type === 'glob') {
    // Glob: check for forbidden matches
    const matches = checkGlob(wsPath, rule.path_pattern);

    if (rule.level === 'forbidden') {
      if (matches.length === 0) {
        results.push({
          type: 'case',
          id: caseId,
          status: 'pass',
          label: label('없음'),
        });
      } else {
        for (const m of matches) {
          results.push({
            type: 'case',
            id: `${botId}/${m}`,
            status: rule.severity === 'error' ? 'fail' : 'warn',
            label: label(`금지 항목 탐지: ${m}`),
            detail: rule.description || undefined,
          });
        }
      }
    }
    return results;
  }

  const fullPath = path.join(wsPath, rule.path_pattern);
  const { exists, isSymlink, isDir } = checkExistence(fullPath);

  // Required
  if (rule.level === 'required') {
    if (!exists) {
      results.push({
        type: 'case',
        id: caseId,
        status: 'fail',
        label: label('없음'),
        detail: rule.description || undefined,
      });
      return results;
    }

    // Type check
    if (rule.entry_type === 'symlink' && !isSymlink) {
      results.push({
        type: 'case',
        id: caseId,
        status: 'fail',
        label: label('심링크 아님'),
      });
      return results;
    }

    if (rule.entry_type === 'dir' && !isDir) {
      results.push({
        type: 'case',
        id: caseId,
        status: 'fail',
        label: label('디렉토리 아님'),
      });
      return results;
    }

    // Symlink target check
    if (rule.entry_type === 'symlink' && rule.symlink_target) {
      const { ok, actual } = checkSymlinkTarget(fullPath, rule.symlink_target);
      if (!ok) {
        results.push({
          type: 'case',
          id: caseId,
          status: 'fail',
          label: label(`심링크 타겟 불일치 (actual: ${actual})`),
        });
        return results;
      }
    }

    // Content rules
    if (rule.content_rules && rule.entry_type === 'file') {
      const { passed, details } = checkContentRules(fullPath, rule.content_rules);
      if (!passed) {
        results.push({
          type: 'case',
          id: caseId,
          status: rule.severity === 'error' ? 'fail' : 'warn',
          label: label(details.join('; ')),
        });
        return results;
      }
    }

    // All checks passed
    results.push({
      type: 'case',
      id: caseId,
      status: 'pass',
      label: label('OK'),
    });
  }

  // Optional — only warn if content rules fail
  if (rule.level === 'optional') {
    if (!exists) {
      results.push({
        type: 'case',
        id: caseId,
        status: 'warn',
        label: label('없음 (선택)'),
      });
    } else {
      results.push({
        type: 'case',
        id: caseId,
        status: 'pass',
        label: label('OK'),
      });
    }
  }

  // Forbidden
  if (rule.level === 'forbidden') {
    if (exists) {
      results.push({
        type: 'case',
        id: caseId,
        status: rule.severity === 'error' ? 'fail' : 'warn',
        label: label('금지 항목 존재'),
        detail: rule.description || undefined,
      });
    } else {
      results.push({
        type: 'case',
        id: caseId,
        status: 'pass',
        label: label('없음'),
      });
    }
  }

  return results;
}

export async function runDeclarativeWorkspaceAudit(pool: Pool): Promise<TestOutputLine[]> {
  // 1. Load rules from DB
  const { rows: rules } = await pool.query<WorkspaceRule>(
    `SELECT path_pattern, entry_type, level, severity, category,
            bot_scope, bot_ids, symlink_target, content_rules, description
     FROM semo.bot_workspace_standard
     WHERE spec_version = '2.0'
     ORDER BY category, level DESC, path_pattern`,
  );

  // 2. Load bot list from DB
  const { rows: bots } = await pool.query<{ bot_id: string }>(
    `SELECT DISTINCT bot_id FROM semo.bot_status WHERE bot_id != 'shared' ORDER BY bot_id`,
  );

  const results: TestOutputLine[] = [];

  // 3. Bot × Rule matrix
  for (const bot of bots) {
    const wsPath = resolveBotWorkspace(bot.bot_id);

    // Check workspace exists
    if (!fs.existsSync(wsPath)) {
      results.push({
        type: 'case',
        id: `${bot.bot_id}/workspace`,
        status: 'fail',
        label: `${bot.bot_id}: 워크스페이스 없음 (${wsPath})`,
      });
      continue;
    }

    for (const rule of rules) {
      // bot_scope filter
      if (rule.bot_scope === 'include' && !rule.bot_ids.includes(bot.bot_id)) {
        continue;
      }
      if (rule.bot_scope === 'exclude' && rule.bot_ids.includes(bot.bot_id)) {
        continue;
      }

      const ruleResults = checkRule(wsPath, bot.bot_id, rule);
      results.push(...ruleResults);
    }
  }

  // 4. Summary
  let pass = 0,
    fail = 0,
    warn = 0;
  for (const r of results) {
    if (r.status === 'pass') pass++;
    else if (r.status === 'fail') fail++;
    else if (r.status === 'warn') warn++;
  }

  results.push({ type: 'summary', pass, fail, warn } as any);

  return results;
}
