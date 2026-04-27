/**
 * P5-7 guard 등가성 — sh 동작과 1:1 매칭 케이스 (Codex 리뷰 반영).
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CLI = path.resolve(__dirname, '..', '..', 'dist', 'bundle.js');

function run(args: string[], stdin: string): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      input: stdin,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      code: e.status ?? 1,
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? ''),
    };
  }
}

const BOT_CWD = '/Users/reus/.semo/sessions/semiclaw';
const NON_BOT_CWD = '/tmp/anywhere';

describe('semo guard run response-length', () => {
  it('빈 입력 → exit 0, 출력 없음', () => {
    const r = run(['guard', 'run', 'response-length'], '');
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('JSON parse 실패 → exit 0', () => {
    const r = run(['guard', 'run', 'response-length'], 'not-json');
    expect(r.code).toBe(0);
  });

  it('BOT_CWD 미설정 → exit 0 (sh 와 동일)', () => {
    const r = run(
      ['guard', 'run', 'response-length'],
      JSON.stringify({
        cwd: NON_BOT_CWD,
        last_assistant_message: Array(30).fill('line').join('\n'),
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('짧은 응답 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'response-length'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: 'line1\nline2' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('25줄 응답 → WARN', () => {
    const r = run(
      ['guard', 'run', 'response-length'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: Array.from({ length: 25 }, (_, i) => `l${i}`).join('\n'),
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('WARN: 응답이 25줄');
  });

  it('코드 블록은 카운트 제외 — 코드 100줄이라도 외곽 5줄이면 WARN 없음', () => {
    const code = '```ts\n' + Array.from({ length: 100 }, (_, i) => `c${i}`).join('\n') + '\n```';
    const text = `요약 1\n요약 2\n${code}\n요약 3\n요약 4\n요약 5`;
    const r = run(
      ['guard', 'run', 'response-length'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: text }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('여러 fenced code block 모두 제외', () => {
    const text =
      '머리 1\n머리 2\n```js\n' +
      Array(50).fill('a').join('\n') +
      '\n```\n중간\n```py\n' +
      Array(50).fill('b').join('\n') +
      '\n```\n꼬리';
    const r = run(
      ['guard', 'run', 'response-length'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: text }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('last_assistant_message 가 string[] 형태도 허용 (SDK 변종)', () => {
    const arr = Array.from({ length: 25 }, (_, i) => `l${i}`);
    const r = run(
      ['guard', 'run', 'response-length'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: arr }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('WARN: 응답이 25줄');
  });

  it('--limit 50 → 25줄 미경고', () => {
    const r = run(
      ['guard', 'run', 'response-length', '--limit', '50'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: Array.from({ length: 25 }, (_, i) => `l${i}`).join('\n'),
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe('semo guard run kb-search-loop', () => {
  it('빈 입력 → exit 0', () => {
    const r = run(['guard', 'run', 'kb-search-loop'], '');
    expect(r.code).toBe(0);
  });

  it('BOT_SESSION 미설정 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'kb-search-loop'],
      JSON.stringify({ cwd: NON_BOT_CWD, transcript_path: '/tmp/x' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('빈 transcript_path → exit 0', () => {
    const r = run(
      ['guard', 'run', 'kb-search-loop'],
      JSON.stringify({ cwd: BOT_CWD, transcript_path: '' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('transcript 파일 없음 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'kb-search-loop'],
      JSON.stringify({ cwd: BOT_CWD, transcript_path: '/tmp/nonexistent-' + Date.now() }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('search 3회 + get 0회 → BLOCK', () => {
    const tp = path.join(os.tmpdir(), `kb-loop-${Date.now()}.jsonl`);
    fs.writeFileSync(
      tp,
      [
        'noise',
        '{"tool":"semo kb search foo"}',
        '{"tool":"semo kb search bar"}',
        '{"tool":"semo kb search baz"}',
      ].join('\n'),
    );
    const r = run(
      ['guard', 'run', 'kb-search-loop'],
      JSON.stringify({ cwd: BOT_CWD, transcript_path: tp }),
    );
    fs.unlinkSync(tp);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('BLOCK: KB 검색이 3회');
  });

  it('search 3회 + get 1회 → BLOCK 없음', () => {
    const tp = path.join(os.tmpdir(), `kb-loop-${Date.now()}.jsonl`);
    fs.writeFileSync(
      tp,
      [
        '{"tool":"semo kb search foo"}',
        '{"tool":"semo kb search bar"}',
        '{"tool":"semo kb search baz"}',
        '{"tool":"semo kb get foo bar"}',
      ].join('\n'),
    );
    const r = run(
      ['guard', 'run', 'kb-search-loop'],
      JSON.stringify({ cwd: BOT_CWD, transcript_path: tp }),
    );
    fs.unlinkSync(tp);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});
