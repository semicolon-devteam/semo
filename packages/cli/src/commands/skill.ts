/**
 * semo skill — 스킬 목록 조회 및 편집 + 자동 동기화.
 *
 * 봇 스킬(SKILL.md) 수정 시 canonical source → DB → cache → mirror 동기화를
 * 단일 명령으로 처리하여 수동 5단계 프로세스를 자동화한다.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { spawnSync, execSync } from 'child_process';
import { getPool, closeConnection, isDbConnected, getActiveSkills } from '../database';
import { syncGlobalCache } from '../global-cache';
import { populateBotMirrors } from '../semo-workspace';
import { syncSkillsToDB } from './skill-sync';
import { syncWorkspaceFiles } from './bots';

export function registerSkillCommands(program: Command): void {
  const skillCmd = program.command('skill').description('스킬 관리 및 편집');

  // ── semo skill list ──

  skillCmd
    .command('list')
    .description('등록된 스킬 목록')
    .option('--bot <botId>', '특정 봇 스킬만')
    .option('--json', 'JSON 출력')
    .action(async (options: { bot?: string; json?: boolean }) => {
      const spinner = ora('스킬 목록 조회 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const skills = await getActiveSkills();
        spinner.stop();

        const filtered = options.bot
          ? skills.filter((s) => s.bot_ids?.includes(options.bot!))
          : skills;

        if (options.json) {
          console.log(
            JSON.stringify(
              filtered.map((s) => ({
                name: s.name,
                bot_ids: s.bot_ids,
                category: s.category,
                canonical: resolveCanonicalPath(s.name, s.bot_ids?.[0]),
              })),
              null,
              2,
            ),
          );
        } else {
          console.log(chalk.bold(`\n스킬 목록 (${filtered.length}개)\n`));
          console.log(
            chalk.gray(
              `${'이름'.padEnd(30)} ${'봇'.padEnd(25)} ${'카테고리'.padEnd(15)} canonical`,
            ),
          );
          console.log(chalk.gray('─'.repeat(100)));
          for (const s of filtered) {
            const bots = (s.bot_ids ?? []).join(', ') || '-';
            const canonical = resolveCanonicalPath(s.name, s.bot_ids?.[0]);
            const exists = canonical ? fs.existsSync(canonical) : false;
            console.log(
              `${s.name.padEnd(30)} ${bots.padEnd(25)} ${(s.category || '-').padEnd(15)} ${exists ? chalk.green(canonical) : chalk.red('없음')}`,
            );
          }
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo skill edit <skillName> ──

  skillCmd
    .command('edit <skillName>')
    .description('스킬 편집 + 자동 동기화')
    .option('--bot <botId>', '특정 봇 스킬 지정 (복수 봇 시 필수)')
    .option('--no-sync', '편집만, 동기화 스킵')
    .option('--restart', '오케스트레이터 재시작 포함')
    .action(
      async (skillName: string, options: { bot?: string; sync?: boolean; restart?: boolean }) => {
        const connected = await isDbConnected();
        if (!connected) {
          console.error(chalk.red('DB 연결 실패'));
          await closeConnection();
          process.exit(1);
        }

        try {
          // 1. 스킬 해석
          const skills = await getActiveSkills();
          const skill = skills.find((s) => s.name === skillName);
          if (!skill) {
            console.error(chalk.red(`스킬 '${skillName}'을 찾을 수 없습니다.`));
            console.log(chalk.gray('semo skill list 로 등록된 스킬을 확인하세요.'));
            process.exit(1);
          }

          const botIds = skill.bot_ids ?? [];
          let targetBotId: string;

          if (options.bot) {
            if (!botIds.includes(options.bot)) {
              console.error(
                chalk.red(
                  `봇 '${options.bot}'은 이 스킬의 소유자가 아닙니다. 소유자: ${botIds.join(', ')}`,
                ),
              );
              process.exit(1);
            }
            targetBotId = options.bot;
          } else if (botIds.length === 1) {
            targetBotId = botIds[0];
          } else if (botIds.length > 1) {
            console.error(
              chalk.red(
                `이 스킬은 복수 봇(${botIds.join(', ')})에 연결되어 있습니다. --bot <botId> 를 지정하세요.`,
              ),
            );
            process.exit(1);
          } else {
            console.error(chalk.red('이 스킬에 연결된 봇이 없습니다.'));
            process.exit(1);
          }

          // 2. canonical path 결정
          const canonicalPath = resolveCanonicalPath(skillName, targetBotId);
          if (!canonicalPath || !fs.existsSync(canonicalPath)) {
            console.error(chalk.red(`canonical source를 찾을 수 없습니다: ${canonicalPath}`));
            console.log(
              chalk.gray(`경로: ~/.openclaw-${targetBotId}/workspace/skills/${skillName}/SKILL.md`),
            );
            process.exit(1);
          }

          // 3. 에디터 열기 전 hash 저장
          const beforeHash = fileHash(canonicalPath);
          const editor = process.env.EDITOR || 'vim';

          console.log(chalk.cyan(`\n${editor}로 ${skillName} SKILL.md 편집 중...`));
          console.log(chalk.gray(`경로: ${canonicalPath}\n`));

          const result = spawnSync(editor, [canonicalPath], {
            stdio: 'inherit',
            env: process.env,
          });

          if (result.status !== 0) {
            console.error(chalk.red('에디터가 비정상 종료되었습니다.'));
            process.exit(1);
          }

          // 4. 변경 여부 확인
          const afterHash = fileHash(canonicalPath);
          if (beforeHash === afterHash) {
            console.log(chalk.yellow('변경 없음. 동기화를 스킵합니다.'));
            return;
          }

          console.log(chalk.green('✓ 파일 변경 감지'));

          // 5. 동기화 파이프라인
          if (options.sync === false) {
            console.log(chalk.yellow('--no-sync 옵션으로 동기화를 스킵합니다.'));
            return;
          }

          const syncSpinner = ora('동기화 중...').start();
          const pool = getPool();
          const client = await pool.connect();

          try {
            // a. skill_definitions 업데이트
            syncSpinner.text = '① skill_definitions DB 업데이트...';
            await syncSkillsToDB(client, pool);

            // b. global cache 재생성
            syncSpinner.text = '② ~/.claude/skills/ 재생성...';
            await syncGlobalCache();

            // c. bot mirror 재생성
            syncSpinner.text = '③ ~/.claude/semo/bots/ 재생성...';
            await populateBotMirrors();

            // d. bot_workspace_files 업데이트
            syncSpinner.text = '④ bot_workspace_files DB 업데이트...';
            const wsDir = path.join(os.homedir(), `.openclaw-${targetBotId}`, 'workspace');
            if (fs.existsSync(wsDir)) {
              await syncWorkspaceFiles(client, targetBotId, wsDir);
            }

            syncSpinner.succeed('동기화 완료 (4단계 모두 성공)');
          } finally {
            client.release();
          }

          // 6. 오케스트레이터 재시작
          if (options.restart) {
            restartOrchestrator();
          } else {
            console.log(
              chalk.gray(
                '\n오케스트레이터 재시작이 필요하면: semo skill edit --restart 또는 수동 재시작',
              ),
            );
          }
        } catch (err) {
          console.error(chalk.red(`실패: ${err}`));
          process.exit(1);
        } finally {
          await closeConnection();
        }
      },
    );

  // ── semo skill sync ──

  skillCmd
    .command('sync')
    .description('스킬 전체 동기화 (편집 없이)')
    .action(async () => {
      const spinner = ora('전체 스킬 동기화 중...').start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail('DB 연결 실패');
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        try {
          spinner.text = '① skill_definitions...';
          await syncSkillsToDB(client, pool);

          spinner.text = '② global cache...';
          await syncGlobalCache();

          spinner.text = '③ bot mirrors...';
          await populateBotMirrors();

          spinner.succeed('전체 스킬 동기화 완료');
        } finally {
          client.release();
        }
      } catch (err) {
        spinner.fail(`동기화 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}

// ── Helpers ──

function resolveCanonicalPath(skillName: string, botId?: string): string | null {
  if (!botId) return null;
  return path.join(
    os.homedir(),
    `.openclaw-${botId}`,
    'workspace',
    'skills',
    skillName,
    'SKILL.md',
  );
}

function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function restartOrchestrator(): void {
  try {
    const psOutput = execSync('ps aux', { encoding: 'utf-8' });
    const lines = psOutput
      .split('\n')
      .filter((l) => l.includes('tsx') && l.includes('src/index.ts') && l.includes('orchestrator'));

    if (lines.length === 0) {
      console.log(chalk.yellow('\n오케스트레이터 프로세스를 찾을 수 없습니다.'));
      return;
    }

    for (const line of lines) {
      const pid = line.trim().split(/\s+/)[1];
      if (pid) {
        execSync(`kill ${pid}`);
        console.log(chalk.green(`\n✓ 오케스트레이터 종료 (PID: ${pid})`));
      }
    }
    console.log(
      chalk.cyan('수동으로 재시작하세요: cd packages/orchestrator && npx tsx src/index.ts'),
    );
  } catch {
    console.log(chalk.yellow('\n오케스트레이터 재시작 실패. 수동으로 재시작하세요.'));
  }
}
