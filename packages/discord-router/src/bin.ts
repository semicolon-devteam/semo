#!/usr/bin/env node
/**
 * discord-router CLI 엔트리 — 환경변수만 읽고 startDiscordRouter() 호출.
 *
 * `npm start` / `semo router start --platform discord` 가 최종적으로 이 파일을
 * 돌린다. library 로 쓰고 싶을 땐 `import { startDiscordRouter } from '...'` 로
 * index.ts 를 직접 import 한다 (bin.ts 의 side-effect 를 피하려고 분리).
 */
import { startDiscordRouter, type StopFn } from './index.js';

async function main(): Promise<void> {
  let stop: StopFn;
  try {
    stop = await startDiscordRouter();
  } catch (err) {
    console.error('[discord-router] Startup failed:', err);
    process.exit(1);
  }

  const shutdown = async (): Promise<void> => {
    try {
      await stop();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('uncaughtException', (err) => {
    console.error('[discord-router] uncaughtException (kept alive):', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[discord-router] unhandledRejection (kept alive):', reason);
  });
}

main();
