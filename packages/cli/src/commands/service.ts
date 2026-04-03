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
  diagnoseServiceStatus,
  updateServiceProject,
  type MigrationResult,
} from "../service-migrate";

export function registerServiceCommands(program: Command): void {
  const service = program
    .command("service")
    .description("서비스 관리 — 이식, 목록 조회, 진단, 업데이트");

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

  // ── semo service diagnose ──
  service
    .command("diagnose")
    .description("서비스 KB ↔ service_projects 교차 진단")
    .requiredOption("--domain <name>", "진단할 서비스 도메인")
    .action(async (options: { domain: string }) => {
      const pool = getPool();
      const spinner = ora("서비스 진단 중...").start();

      try {
        const result = await diagnoseServiceStatus(pool, options.domain);
        spinner.stop();

        console.log(chalk.cyan.bold(`\n🔍 서비스 진단: ${result.domain}\n`));

        // KB 상태
        if (result.kbEntryCount > 0) {
          console.log(chalk.bold("  ┌─ KB ─────────────────────────────┐"));
          console.log(`  │ 도메인: ${result.domain} (service)`);
          console.log(`  │ KB 엔트리: ${result.kbEntryCount}개`);
          console.log(`  │ 키: ${result.kbKeys.join(", ")}`);
          if (result.missingRequired.length > 0) {
            console.log(chalk.yellow(`  │ 필수 키 누락: ${result.missingRequired.join(", ")}`));
          }
          console.log(chalk.bold("  └──────────────────────────────────┘\n"));
        } else {
          console.log(chalk.yellow("  KB 도메인 없음\n"));
        }

        // service_projects 상태
        const sp = result.serviceProject;
        if (sp) {
          console.log(chalk.bold("  ┌─ service_projects ────────────────┐"));
          console.log(`  │ gfp_id: ${sp.gfp_id}`);
          console.log(`  │ project_name: ${sp.project_name}`);
          console.log(`  │ owner_name: ${sp.owner_name}`);
          console.log(`  │ lifecycle: ${sp.lifecycle}`);
          console.log(`  │ current_phase: ${sp.current_phase}`);
          console.log(`  │ status: ${sp.status}`);
          if (sp.launched_at) {
            console.log(`  │ launched_at: ${sp.launched_at}`);
          }
          console.log(chalk.bold("  └─────────────────────────────────┘\n"));
        } else {
          console.log(chalk.yellow("  service_projects 미등록\n"));
        }

        // 교차 검증
        if (result.mismatches.length > 0) {
          console.log(chalk.bold("  ┌─ 교차 검증 ──────────────────────┐"));
          for (const m of result.mismatches) {
            console.log(chalk.yellow(`  │ ⚠️  ${m.field}: KB=${m.kbValue}, SP=${m.spValue}`));
            console.log(chalk.gray(`  │    기대값: ${m.expected}`));
          }
          console.log(chalk.bold("  └─────────────────────────────────┘\n"));
        }

        // Verdict
        const verdictMap: Record<string, string> = {
          healthy: chalk.green("✅ HEALTHY — 정합성 양호"),
          mismatch: chalk.yellow(`⚠️  MISMATCH (${result.mismatches.length}건)`),
          "kb-only": chalk.yellow("⚠️  KB-ONLY — service_projects 미등록"),
          "sp-only": chalk.red("❌ SP-ONLY — KB 도메인 없음 (비정상)"),
          missing: chalk.red("❌ MISSING — KB, service_projects 모두 없음"),
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
    .command("update")
    .description("service_projects 레코드 업데이트")
    .requiredOption("--domain <name>", "대상 서비스 도메인")
    .option("--status <status>", "서비스 상태 (active|paused|completed)")
    .option("--lifecycle <lifecycle>", "라이프사이클 (build|ops|sunset)")
    .option("--phase <number>", "현재 phase (0-9)", parseInt)
    .option("--name <projectName>", "프로젝트명")
    .option("--owner <ownerName>", "오너명")
    .action(
      async (options: {
        domain: string;
        status?: string;
        lifecycle?: string;
        phase?: number;
        name?: string;
        owner?: string;
      }) => {
        const pool = getPool();
        const spinner = ora("서비스 업데이트 중...").start();

        try {
          // Validate enum values
          const validStatuses = ["active", "paused", "completed"];
          if (options.status && !validStatuses.includes(options.status)) {
            spinner.fail(`잘못된 status: '${options.status}' (허용: ${validStatuses.join(", ")})`);
            await closeConnection();
            return;
          }

          const validLifecycles = ["build", "ops", "sunset"];
          if (options.lifecycle && !validLifecycles.includes(options.lifecycle)) {
            spinner.fail(
              `잘못된 lifecycle: '${options.lifecycle}' (허용: ${validLifecycles.join(", ")})`
            );
            await closeConnection();
            return;
          }

          if (options.phase !== undefined && (options.phase < 0 || options.phase > 9)) {
            spinner.fail(`잘못된 phase: ${options.phase} (허용: 0-9)`);
            await closeConnection();
            return;
          }

          const updates: Record<string, unknown> = {};
          if (options.status) updates.status = options.status;
          if (options.lifecycle) updates.lifecycle = options.lifecycle;
          if (options.phase !== undefined) updates.current_phase = options.phase;
          if (options.name) updates.project_name = options.name;
          if (options.owner) updates.owner_name = options.owner;

          if (Object.keys(updates).length === 0) {
            spinner.info("업데이트할 항목이 없습니다. --status, --lifecycle, --phase 등을 지정하세요.");
            await closeConnection();
            return;
          }

          const result = await updateServiceProject(pool, options.domain, updates);

          if (!result) {
            spinner.fail(`'${options.domain}'은(는) service_projects에 등록되지 않았습니다.`);
            await closeConnection();
            return;
          }

          spinner.succeed(`'${options.domain}' 업데이트 완료`);

          console.log(chalk.gray(
            `  project_name: ${result.project_name}\n` +
            `  owner_name: ${result.owner_name}\n` +
            `  lifecycle: ${result.lifecycle}\n` +
            `  current_phase: ${result.current_phase}\n` +
            `  status: ${result.status}\n` +
            `  launched_at: ${result.launched_at ?? "(없음)"}\n` +
            `  updated_at: ${result.updated_at}`
          ));
          console.log();
        } catch (err) {
          spinner.fail(`업데이트 실패: ${(err as Error).message}`);
        } finally {
          await closeConnection();
        }
      }
    );
}
