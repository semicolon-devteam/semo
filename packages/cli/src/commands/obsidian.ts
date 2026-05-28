/**
 * `semo obsidian` — Obsidian vault 양방향 동기화 CLI.
 *
 * - `semo obsidian sync`  : vault 1회 재인덱스 (start → ready → close)
 * - `semo obsidian watch` : vault file watcher (SIGINT 까지 유지)
 *
 * 사용 조건:
 * - `~/.semo/config.toml` 의 `kb.driver = "obsidian"` + `kb.obsidian_vault` 설정.
 * - 또는 `--vault <path>` 로 ad-hoc 지정 (config 무시).
 *
 * 동기화 메커니즘은 `packages/kb-core/src/adapters/obsidian/obsidian-kb-store.ts` 에 위임.
 * 본 CLI 는 thin wrapper — `openStores(cfg)` 호출하면 ObsidianKbStore 가
 * 자체 fs.watch + sidecar SQLite + 충돌 처리까지 다 한다.
 *
 * KB: semo decision/one-agent-experience-implementation-2026-05-27 의 P0-D
 */
import { Command } from 'commander';
import * as fs from 'fs';
import chalk from 'chalk';
import { loadProfile } from '../config/index.js';
import { openStores } from '../config/store-factory.js';
import type { SemoConfig } from '../config/types.js';

function resolveObsidianConfig(opts: { vault?: string; configPath?: string }): SemoConfig {
  const cfg = loadProfile(opts.configPath);
  if (opts.vault) {
    return {
      ...cfg,
      kb: {
        ...cfg.kb,
        driver: 'obsidian',
        obsidian_vault: opts.vault,
      },
    };
  }
  if (cfg.kb.driver !== 'obsidian') {
    throw new Error(
      `현재 config 의 kb.driver=${cfg.kb.driver}. obsidian 으로 설정하거나 --vault 옵션을 사용하세요.`,
    );
  }
  return cfg;
}

async function runSync(cfg: SemoConfig): Promise<void> {
  console.log(chalk.cyan(`[obsidian] sync 시작 — vault=${cfg.kb.obsidian_vault}`));
  const t0 = Date.now();
  const stores = await openStores(cfg);
  // ObsidianKbStore.ready() 가 store-factory 안에서 이미 await 됨 → 초기 인덱싱 완료.
  console.log(chalk.green(`[obsidian] sync 완료 (${Date.now() - t0}ms)`));
  await stores.close();
}

async function runWatch(cfg: SemoConfig): Promise<void> {
  console.log(chalk.cyan(`[obsidian] watch 시작 — vault=${cfg.kb.obsidian_vault}`));
  const stores = await openStores(cfg);

  let changeCount = 0;
  const unsubscribe = await stores.kb.watch((evt) => {
    changeCount += 1;
    const tag = evt.type ?? 'change';
    const tail = `${evt.domain}/${evt.key}${evt.subKey ? '/' + evt.subKey : ''}`;
    console.log(chalk.gray(`[obsidian] #${changeCount} ${tag} ${tail}`));
  });

  console.log(chalk.green('[obsidian] watch 활성 — Ctrl+C 로 종료'));

  // SIGINT 처리
  const shutdown = async () => {
    console.log(chalk.yellow('\n[obsidian] 종료 요청 수신, watcher 해제 중...'));
    try {
      await unsubscribe();
    } catch (err) {
      console.warn('[obsidian] unsubscribe 실패:', (err as Error).message);
    }
    await stores.close();
    console.log(chalk.green('[obsidian] 종료 완료'));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // foreground daemon — Promise never resolves
  await new Promise(() => {});
}

export function registerObsidianCommands(program: Command): void {
  const obs = program
    .command('obsidian')
    .description('Obsidian vault 양방향 동기화 (KB.driver=obsidian 또는 --vault 지정 시)');

  obs
    .command('sync')
    .description('vault 1회 재인덱스 (start → ready → close)')
    .option('--vault <path>', 'ad-hoc vault 경로 (config 무시)')
    .option('--config <path>', '대체 config.toml 경로')
    .action(async (opts: { vault?: string; config?: string }) => {
      try {
        const cfg = resolveObsidianConfig({ vault: opts.vault, configPath: opts.config });
        if (cfg.kb.obsidian_vault && !fs.existsSync(cfg.kb.obsidian_vault)) {
          throw new Error(`vault 경로 없음: ${cfg.kb.obsidian_vault}`);
        }
        await runSync(cfg);
      } catch (err) {
        console.error(chalk.red(`[obsidian sync] 실패: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  obs
    .command('watch')
    .description('vault file watcher (foreground daemon, Ctrl+C 까지)')
    .option('--vault <path>', 'ad-hoc vault 경로 (config 무시)')
    .option('--config <path>', '대체 config.toml 경로')
    .action(async (opts: { vault?: string; config?: string }) => {
      try {
        const cfg = resolveObsidianConfig({ vault: opts.vault, configPath: opts.config });
        if (cfg.kb.obsidian_vault && !fs.existsSync(cfg.kb.obsidian_vault)) {
          throw new Error(`vault 경로 없음: ${cfg.kb.obsidian_vault}`);
        }
        await runWatch(cfg);
      } catch (err) {
        console.error(chalk.red(`[obsidian watch] 실패: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
