import { Command } from 'commander';
import chalk from 'chalk';
import { loadProfile, resolveAuthToken } from '../config';
import type { NetworkMode } from '../config/types';

/**
 * `semo topology` — 현재 network.mode 에 맞는 접속 가이드 출력.
 *
 * Phase 9 (LAN/Tailscale/sync) 의 사용자 대면 결과물. HttpSource 가 인증 토큰을 요구하는
 * 현재 상태에서, 모바일 / 노트북에서 실제로 접속하려면 어떤 명령을 써야 하는지
 * 노골적으로 보여주는 게 목적이다 — 별도 문서를 찾게 만들지 않는다.
 */
export function registerTopologyCommand(program: Command): void {
  program
    .command('topology')
    .description('현재 프로파일에 따른 네트워크 토폴로지/접속 가이드 출력')
    .option('-p, --path <file>', 'config.toml 경로 오버라이드')
    .action((opts: { path?: string }) => {
      const cfg = loadProfile(opts.path);
      const token = resolveAuthToken(cfg.network);
      const listen = cfg.network.listen ?? '127.0.0.1:3939';
      const mode: NetworkMode = cfg.network.mode;

      console.log(chalk.bold('\nSEMO Topology'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`profile  : ${cfg.profile}`);
      console.log(`mode     : ${mode}`);
      console.log(`listen   : ${listen}`);
      console.log(`auth     : ${token ? 'bearer token set' : chalk.yellow('no token')}`);
      console.log();

      if (mode === 'offline') {
        console.log(chalk.gray('offline: 127.0.0.1 바인드. 외부에서 접근 불가.'));
        console.log(chalk.gray('  curl http://127.0.0.1:3939/inbox -d \'{"text":"..."}\''));
        console.log();
        return;
      }

      if (mode === 'lan') {
        console.log(chalk.bold('LAN mode'));
        console.log('  1. listen 을 0.0.0.0:<port> 로 바꾼다 (~/.semo/config.toml).');
        console.log('  2. 같은 네트워크의 다른 기기에서:');
        console.log(
          `     curl -H "Authorization: Bearer ${token ?? '<token>'}" http://<host-ip>:${portOf(listen)}/outbox`,
        );
        console.log(chalk.yellow('  ! LAN 은 방화벽/공유기 설정에 따라 외부로도 노출될 수 있음.'));
        console.log();
      }

      if (mode === 'tailscale') {
        console.log(chalk.bold('Tailscale mode'));
        console.log('  1. tailscale up (해당 머신 + 접근 기기 모두).');
        console.log('  2. 권장: tailscale serve —');
        console.log(`     sudo tailscale serve https / http://127.0.0.1:${portOf(listen)}`);
        console.log('     그러면 https://<machine>.<tailnet>.ts.net 으로 접근 가능.');
        console.log('  3. 모바일/노트북에서:');
        console.log(
          `     curl -H "Authorization: Bearer ${token ?? '<token>'}" https://<machine>.<tailnet>.ts.net/outbox`,
        );
        console.log();
      }

      if (!token) {
        console.log(
          chalk.yellow(
            '⚠ LAN/Tailscale 에서는 network.auth_token (또는 auth_token_env) 설정을 강권합니다.',
          ),
        );
        console.log(chalk.gray('  ex) [network] auth_token_env = "SEMO_HTTP_TOKEN"'));
        console.log();
      }
    });
}

function portOf(listen: string): string {
  const m = listen.match(/:(\d+)$/);
  return m ? m[1] : '3939';
}
