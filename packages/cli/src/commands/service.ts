/**
 * semo service — 서비스 관리
 *
 * semo service migrate --domain {name}    — 특정 서비스 이식
 * semo service migrate --all              — 미등록 전체 이식
 * semo service migrate --all --dry-run    — 미리보기
 * semo service list                       — 등록/미등록 서비스 목록
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getPool, closeConnection } from '../database';
import {
  getUnregisteredServices,
  getRegisteredServices,
  auditServiceKBEntries,
  buildServiceProjectRow,
  insertServiceProject,
  writePmSummaryToKB,
  printAuditReport,
  printDryRunReport,
  diagnoseServiceStatus,
  updateServiceProject,
  type MigrationResult,
} from '../service-migrate';

export function registerServiceCommands(program: Command): void {
  const service = program
    .command('service')
    .description('서비스 관리 — 이식, 목록 조회, 진단, 업데이트');

  // ── semo service migrate ──
  service
    .command('migrate')
    .description('기존 서비스를 services 테이블에 이식')
    .option('--domain <name>', '특정 서비스 도메인')
    .option('--all', '미등록 서비스 전체 이식')
    .option('--dry-run', '미리보기 (DB 변경 없음)')
    .action(async (options: { domain?: string; all?: boolean; dryRun?: boolean }) => {
      if (!options.domain && !options.all) {
        console.log(chalk.yellow('--domain <name> 또는 --all 옵션이 필요합니다.'));
        await closeConnection();
        return;
      }

      const pool = getPool();
      const spinner = ora('서비스 이식 준비 중...').start();

      try {
        // 1. 미등록 서비스 조회
        const unregistered = await getUnregisteredServices(pool);

        if (unregistered.length === 0) {
          spinner.succeed('모든 서비스가 이미 등록되어 있습니다.');
          await closeConnection();
          return;
        }

        // 2. 대상 필터링
        let targets = unregistered;
        if (options.domain) {
          targets = unregistered.filter((s) => s.domain === options.domain);
          if (targets.length === 0) {
            // 도메인이 있는데 미등록 목록에 없으면 → 이미 등록됨 또는 미존재
            const registered = await getRegisteredServices(pool);
            if (registered.includes(options.domain)) {
              spinner.info(`'${options.domain}'은(는) 이미 services에 등록되어 있습니다.`);
            } else {
              spinner.fail(
                `'${options.domain}'은(는) 온톨로지에 service 타입으로 등록되지 않았습니다.`,
              );
            }
            await closeConnection();
            return;
          }
        }

        spinner.text = `${targets.length}개 서비스 감사(audit) 중...`;

        // 3. 각 서비스 audit
        const results: MigrationResult[] = [];

        for (const svc of targets) {
          const audit = await auditServiceKBEntries(
            pool,
            svc.domain,
            svc.description,
            svc.created_at,
          );

          if (options.dryRun) {
            results.push({ domain: svc.domain, action: 'skipped', audit });
            continue;
          }

          // 4. INSERT
          try {
            const row = buildServiceProjectRow(audit);

            // KB 엔트리 수 조회
            const countResult = await pool.query(
              'SELECT COUNT(*)::int as cnt FROM semo.knowledge_base WHERE domain = $1',
              [svc.domain],
            );
            const kbEntryCount = countResult.rows[0]?.cnt ?? 0;

            const projectId = await insertServiceProject(pool, row);

            // 5. pm-summary projection 쓰기
            await writePmSummaryToKB(pool, svc.domain, projectId, row, kbEntryCount);

            results.push({
              domain: svc.domain,
              action: 'created',
              projectId,
              audit,
            });
          } catch (err) {
            results.push({
              domain: svc.domain,
              action: 'error',
              audit,
              error: (err as Error).message,
            });
          }
        }

        spinner.stop();

        // 6. 결과 리포트
        if (options.dryRun) {
          printDryRunReport(results);
        } else {
          printAuditReport(results);
        }
      } catch (err) {
        spinner.fail(`이식 실패: ${(err as Error).message}`);
      } finally {
        await closeConnection();
      }
    });

  // ── semo service list ──
  service
    .command('list')
    .description('서비스 목록 (등록/미등록 상태 포함)')
    .action(async () => {
      const pool = getPool();

      try {
        const registered = await getRegisteredServices(pool);
        const unregistered = await getUnregisteredServices(pool);

        console.log(chalk.cyan.bold('\n📋 서비스 목록\n'));

        if (registered.length > 0) {
          console.log(chalk.green(`  ✓ 등록됨 (${registered.length}개):`));
          for (const d of registered.sort()) {
            console.log(chalk.gray(`    ${d}`));
          }
        }

        if (unregistered.length > 0) {
          console.log(chalk.yellow(`\n  ○ 미등록 (${unregistered.length}개):`));
          for (const s of unregistered) {
            const desc = s.description ? chalk.gray(` — ${s.description.substring(0, 60)}`) : '';
            console.log(`    ${s.domain}${desc}`);
          }
        }

        console.log();
      } finally {
        await closeConnection();
      }
    });

  // ── semo service get ──
  service
    .command('get')
    .description('서비스 구조화 메타데이터 조회 (services 테이블 SoT)')
    .argument('<domain>', '서비스 도메인')
    .option('--format <type>', '출력 형식 (json|table)', 'json')
    .action(async (domain: string, options: { format: string }) => {
      const pool = getPool();
      try {
        const result = await pool.query(
          `SELECT service_id, project_name, service_domain, owner_name, owner_contact,
                  status, lifecycle, current_phase, infra_phase,
                  tech_stack, service_url, bm, repo, slack_channel, discord_channel,
                  service_type, parent_service_id,
                  metadata, created_at::text, updated_at::text
           FROM semo.services WHERE service_domain = $1`,
          [domain],
        );
        if (result.rows.length === 0) {
          console.error(
            chalk.red(`서비스 '${domain}'을 찾을 수 없습니다. (services 테이블에 미등록)`),
          );
          process.exit(1);
        }
        const row = result.rows[0];
        if (options.format === 'json') {
          console.log(JSON.stringify(row, null, 2));
        } else {
          console.log(chalk.cyan.bold(`\n📦 ${row.project_name}\n`));
          console.log(chalk.gray(`  도메인: ${row.service_domain}`));
          console.log(chalk.gray(`  오너: ${row.owner_name}`));
          console.log(chalk.gray(`  상태: ${row.status} (${row.lifecycle})`));
          console.log(chalk.gray(`  타입: ${row.service_type}`));
          if (row.parent_service_id) console.log(chalk.gray(`  상위: ${row.parent_service_id}`));
          console.log(
            chalk.gray(`  Phase: ${row.current_phase} / Infra: ${row.infra_phase ?? '-'}`),
          );
          if (row.tech_stack) console.log(chalk.gray(`  기술 스택: ${row.tech_stack.join(', ')}`));
          if (row.service_url) console.log(chalk.gray(`  URL: ${row.service_url}`));
          if (row.repo) console.log(chalk.gray(`  레포: ${row.repo}`));
          if (row.slack_channel) console.log(chalk.gray(`  Slack: ${row.slack_channel}`));
          if (row.discord_channel) console.log(chalk.gray(`  Discord: ${row.discord_channel}`));
          if (row.bm) console.log(chalk.gray(`  BM: ${row.bm}`));
          console.log();
        }
      } finally {
        await closeConnection();
      }
    });

  // ── semo service diagnose ──
  service
    .command('diagnose')
    .description('서비스 KB ↔ services 교차 진단')
    .requiredOption('--domain <name>', '진단할 서비스 도메인')
    .action(async (options: { domain: string }) => {
      const pool = getPool();
      const spinner = ora('서비스 진단 중...').start();

      try {
        const result = await diagnoseServiceStatus(pool, options.domain);
        spinner.stop();

        console.log(chalk.cyan.bold(`\n🔍 서비스 진단: ${result.domain}\n`));

        // KB 상태
        if (result.kbEntryCount > 0) {
          console.log(chalk.bold('  ┌─ KB ─────────────────────────────┐'));
          console.log(`  │ 도메인: ${result.domain} (service)`);
          console.log(`  │ KB 엔트리: ${result.kbEntryCount}개`);
          console.log(`  │ 키: ${result.kbKeys.join(', ')}`);
          if (result.missingRequired.length > 0) {
            console.log(chalk.yellow(`  │ 필수 키 누락: ${result.missingRequired.join(', ')}`));
          }
          console.log(chalk.bold('  └──────────────────────────────────┘\n'));
        } else {
          console.log(chalk.yellow('  KB 도메인 없음\n'));
        }

        // services 상태
        const sp = result.serviceProject;
        if (sp) {
          console.log(chalk.bold('  ┌─ services ───────────────────────┐'));
          console.log(`  │ service_id: ${sp.service_id}`);
          console.log(`  │ project_name: ${sp.project_name}`);
          console.log(`  │ owner_name: ${sp.owner_name}`);
          console.log(`  │ lifecycle: ${sp.lifecycle}`);
          console.log(`  │ current_phase: ${sp.current_phase}`);
          console.log(`  │ status: ${sp.status}`);
          if (sp.launched_at) {
            console.log(`  │ launched_at: ${sp.launched_at}`);
          }
          console.log(chalk.bold('  └─────────────────────────────────┘\n'));
        } else {
          console.log(chalk.yellow('  services 미등록\n'));
        }

        // 교차 검증
        if (result.mismatches.length > 0) {
          console.log(chalk.bold('  ┌─ 교차 검증 ──────────────────────┐'));
          for (const m of result.mismatches) {
            console.log(chalk.yellow(`  │ ⚠️  ${m.field}: KB=${m.kbValue}, SP=${m.spValue}`));
            console.log(chalk.gray(`  │    기대값: ${m.expected}`));
          }
          console.log(chalk.bold('  └─────────────────────────────────┘\n'));
        }

        // Verdict
        const verdictMap: Record<string, string> = {
          healthy: chalk.green('✅ HEALTHY — 정합성 양호'),
          mismatch: chalk.yellow(`⚠️  MISMATCH (${result.mismatches.length}건)`),
          'kb-only': chalk.yellow('⚠️  KB-ONLY — services 미등록'),
          'sp-only': chalk.red('❌ SP-ONLY — KB 도메인 없음 (비정상)'),
          missing: chalk.red('❌ MISSING — KB, services 모두 없음'),
        };
        console.log(`  결과: ${verdictMap[result.verdict] ?? result.verdict}\n`);
      } catch (err) {
        spinner.fail(`진단 실패: ${(err as Error).message}`);
      } finally {
        await closeConnection();
      }
    });

  // ── semo service update ──
  service
    .command('update')
    .description('services 레코드 업데이트')
    .requiredOption('--domain <name>', '대상 서비스 도메인')
    .option('--status <status>', '서비스 상태 (active|paused|completed)')
    .option('--lifecycle <lifecycle>', '라이프사이클 (build|ops|sunset)')
    .option('--phase <number>', '현재 phase (0-9)', parseInt)
    .option('--name <projectName>', '프로젝트명')
    .option('--owner <ownerName>', '오너명')
    .option('--tech-stack <stack>', '기술 스택')
    .option('--service-url <url>', '서비스 URL')
    .option('--bm <model>', '비즈니스 모델')
    .option('--repo <repo>', '레포지토리')
    .option('--slack-channel <channel>', 'Slack 채널 ID')
    .option('--discord-channel <channel>', 'Discord 채널 ID')
    .option('--service-type <type>', '서비스 타입 (incubator|general|external|platform)')
    .option('--parent <domain>', '상위 플랫폼 도메인')
    .action(
      async (options: {
        domain: string;
        status?: string;
        lifecycle?: string;
        phase?: number;
        name?: string;
        owner?: string;
        techStack?: string;
        serviceUrl?: string;
        bm?: string;
        repo?: string;
        slackChannel?: string;
        discordChannel?: string;
        serviceType?: string;
        parent?: string;
      }) => {
        const pool = getPool();
        const spinner = ora('서비스 업데이트 중...').start();

        try {
          // Validate enum values
          const validStatuses = ['active', 'paused', 'completed'];
          if (options.status && !validStatuses.includes(options.status)) {
            spinner.fail(`잘못된 status: '${options.status}' (허용: ${validStatuses.join(', ')})`);
            await closeConnection();
            return;
          }

          const validLifecycles = ['build', 'ops', 'sunset'];
          if (options.lifecycle && !validLifecycles.includes(options.lifecycle)) {
            spinner.fail(
              `잘못된 lifecycle: '${options.lifecycle}' (허용: ${validLifecycles.join(', ')})`,
            );
            await closeConnection();
            return;
          }

          if (options.phase !== undefined && (options.phase < 0 || options.phase > 9)) {
            spinner.fail(`잘못된 phase: ${options.phase} (허용: 0-9)`);
            await closeConnection();
            return;
          }

          const validServiceTypes = ['incubator', 'general', 'external', 'platform'];
          if (options.serviceType && !validServiceTypes.includes(options.serviceType)) {
            spinner.fail(
              `잘못된 service-type: '${options.serviceType}' (허용: ${validServiceTypes.join(', ')})`,
            );
            await closeConnection();
            return;
          }

          const updates: Record<string, unknown> = {};
          if (options.status) updates.status = options.status;
          if (options.lifecycle) updates.lifecycle = options.lifecycle;
          if (options.phase !== undefined) updates.current_phase = options.phase;
          if (options.name) updates.project_name = options.name;
          if (options.owner) updates.owner_name = options.owner;
          if (options.techStack !== undefined) updates.tech_stack = options.techStack;
          if (options.serviceUrl !== undefined) updates.service_url = options.serviceUrl;
          if (options.bm !== undefined) updates.bm = options.bm;
          if (options.repo !== undefined) updates.repo = options.repo;
          if (options.slackChannel !== undefined) updates.slack_channel = options.slackChannel;
          if (options.discordChannel !== undefined)
            updates.discord_channel = options.discordChannel;
          if (options.serviceType) updates.service_type = options.serviceType;

          // --parent: 도메인 → service_id 변환
          if (options.parent) {
            const parentResult = await pool.query(
              'SELECT service_id FROM semo.services WHERE service_domain = $1',
              [options.parent],
            );
            if (parentResult.rows.length === 0) {
              spinner.fail(`상위 플랫폼 '${options.parent}'을 찾을 수 없습니다.`);
              await closeConnection();
              return;
            }
            updates.parent_service_id = parentResult.rows[0].service_id;
          }

          if (Object.keys(updates).length === 0) {
            spinner.info(
              '업데이트할 항목이 없습니다. --status, --lifecycle, --phase, --tech-stack 등을 지정하세요.',
            );
            await closeConnection();
            return;
          }

          const result = await updateServiceProject(pool, options.domain, updates);

          if (!result) {
            spinner.fail(`'${options.domain}'은(는) services에 등록되지 않았습니다.`);
            await closeConnection();
            return;
          }

          spinner.succeed(`'${options.domain}' 업데이트 완료`);

          console.log(
            chalk.gray(
              `  project_name: ${result.project_name}\n` +
                `  owner_name: ${result.owner_name}\n` +
                `  lifecycle: ${result.lifecycle}\n` +
                `  service_type: ${result.service_type}\n` +
                `  current_phase: ${result.current_phase}\n` +
                `  status: ${result.status}\n` +
                `  launched_at: ${result.launched_at ?? '(없음)'}\n` +
                `  updated_at: ${result.updated_at}`,
            ),
          );
          console.log();
        } catch (err) {
          spinner.fail(`업데이트 실패: ${(err as Error).message}`);
        } finally {
          await closeConnection();
        }
      },
    );
}
