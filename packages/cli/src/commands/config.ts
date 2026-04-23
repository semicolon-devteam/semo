import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadProfile, describeConfig } from '../config';

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.semo', 'config.toml');

export function registerConfigCommands(cfg: Command): void {
  cfg
    .command('show')
    .description('현재 해석된 프로파일과 3축 어댑터 출력')
    .option('-p, --path <file>', 'config.toml 경로 오버라이드')
    .option('--json', 'JSON으로 출력')
    .action((opts: { path?: string; json?: boolean }) => {
      const config = loadProfile(opts.path);

      if (opts.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      console.log(chalk.bold('\nSEMO Config'));
      console.log(chalk.gray('─'.repeat(48)));
      console.log(describeConfig(config));

      if (!config._source || config._source.startsWith('<default')) {
        console.log();
        console.log(chalk.yellow('⚠ config 파일이 없습니다 — 기본 "team" 프로파일로 동작합니다.'));
        console.log(chalk.gray(`   생성 위치: ${DEFAULT_CONFIG_PATH}`));
        console.log(chalk.gray('   초기화: semo config init (예정)'));
      }
      console.log();
    });

  cfg
    .command('path')
    .description('config.toml 기본 경로 출력')
    .action(() => {
      console.log(process.env.SEMO_CONFIG_PATH ?? DEFAULT_CONFIG_PATH);
    });

  cfg
    .command('validate')
    .description('config.toml 파싱 검증 (구문 오류만 확인)')
    .option('-p, --path <file>', '경로 오버라이드')
    .action((opts: { path?: string }) => {
      const target = opts.path ?? process.env.SEMO_CONFIG_PATH ?? DEFAULT_CONFIG_PATH;
      if (!fs.existsSync(target)) {
        console.log(chalk.yellow(`no config at ${target} (using defaults)`));
        return;
      }
      try {
        loadProfile(target);
        console.log(chalk.green(`✓ ${target} parses ok`));
      } catch (err) {
        console.error(chalk.red(`✗ ${target}: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
