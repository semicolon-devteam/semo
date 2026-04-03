/**
 * semo service — 서비스 관리
 *
 * semo service migrate --domain {name}    — 특정 서비스 이식
 * semo service migrate --all              — 미등록 전체 이식
 * semo service migrate --all --dry-run    — 미리보기
 * semo service list                       — 등록/미등록 서비스 목록
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getPool, closeConnection } from "../database";
import {
  getUnregisteredServices,
  getRegisteredServices,
  auditServiceKBEntries,
  buildServiceProjectRow,
  insertServiceProject,
  writePmSummaryToKB,
  printAuditReport,
  printDryRunReport,
  type MigrationResult,
} from "../service-migrate";

export function registerServiceCommands(program: Command): void {
  const service = program
    .command("service")
    .description("서비스 관리 — 이식, 목록 조회");

  // ── semo service migrate ──
  service
    .command("migrate")
    .description("기존 서비스를 service_projects 테이블에 이식")
    .option("--domain <name>", "특정 서비스 도메인")
    .option("--all", "미등록 서비스 전체 이식")
    .option("--dry-run", "미리보기 (DB 변경 없음)")
    .action(async (options: { domain?: string; all?: boolean; dryRun?: boolean }) => {
      if (!options.domain && !options.all) {
        console.log(chalk.yellow("--domain <name> 또는 --all 옵션이 필요합니다."));
        await closeConnection();
        return;
      }

      const pool = getPool();
      const spinner = ora("서비스 이식 준비 중...").start();

      try {
        // 1. 미등록 서비스 조회
        const unregistered = await getUnregisteredServices(pool);

        if (unregistered.length === 0) {
          spinner.succeed("모든 서비스가 이미 등록되어 있습니다.");
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
              spinner.info(`'${options.domain}'은(는) 이미 service_projects에 등록되어 있습니다.`);
            } else {
              spinner.fail(
                `'${options.domain}'은(는) 온톨로지에 service 타입으로 등록되지 않았습니다.`
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
            svc.created_at
          );

          if (options.dryRun) {
            results.push({ domain: svc.domain, action: "skipped", audit });
            continue;
          }

          // 4. INSERT
          try {
            const row = buildServiceProjectRow(audit);

            // KB 엔트리 수 조회
            const countResult = await pool.query(
              "SELECT COUNT(*)::int as cnt FROM semo.knowledge_base WHERE domain = $1",
              [svc.domain]
            );
            const kbEntryCount = countResult.rows[0]?.cnt ?? 0;

            const projectId = await insertServiceProject(pool, row);

            // 5. pm-summary projection 쓰기
            await writePmSummaryToKB(pool, svc.domain, projectId, row, kbEntryCount);

            results.push({
              domain: svc.domain,
              action: "created",
              projectId,
              audit,
            });
          } catch (err) {
            results.push({
              domain: svc.domain,
              action: "error",
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
    .command("list")
    .description("서비스 목록 (등록/미등록 상태 포함)")
    .action(async () => {
      const pool = getPool();

      try {
        const registered = await getRegisteredServices(pool);
        const unregistered = await getUnregisteredServices(pool);

        console.log(chalk.cyan.bold("\n📋 서비스 목록\n"));

        if (registered.length > 0) {
          console.log(chalk.green(`  ✓ 등록됨 (${registered.length}개):`));
          for (const d of registered.sort()) {
            console.log(chalk.gray(`    ${d}`));
          }
        }

        if (unregistered.length > 0) {
          console.log(chalk.yellow(`\n  ○ 미등록 (${unregistered.length}개):`));
          for (const s of unregistered) {
            const desc = s.description ? chalk.gray(` — ${s.description.substring(0, 60)}`) : "";
            console.log(`    ${s.domain}${desc}`);
          }
        }

        console.log();
      } finally {
        await closeConnection();
      }
    });
}
