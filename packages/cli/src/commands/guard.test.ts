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

describe('semo guard run assertion', () => {
  it('빈 입력 → exit 0', () => {
    const r = run(['guard', 'run', 'assertion'], '');
    expect(r.code).toBe(0);
  });

  it('BOT_CWD 미설정 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'assertion'],
      JSON.stringify({
        cwd: NON_BOT_CWD,
        last_assistant_message: '서버 1번 입니다\n서비스 2번 입니다\n도메인 3번 입니다',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('짧은 응답 (3줄 미만) → exit 0', () => {
    const r = run(
      ['guard', 'run', 'assertion'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: '서버 X 입니다.' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('사실 주장 + 출처 없음 → WARN', () => {
    const text = '안녕하세요.\n서버 X 도메인은 example.com 입니다.\n그 외 자세한 사항은 별도.';
    const r = run(
      ['guard', 'run', 'assertion'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: text }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('WARN: 사실 주장이');
  });

  it('사실 주장 + KB 출처 표기 → exit 0 (WARN 없음)', () => {
    const text = '안녕하세요.\n서버 X 도메인은 example.com 입니다.\n[답변근거: KB infra/server]';
    const r = run(
      ['guard', 'run', 'assertion'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: text }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('코드블록 안 사실 주장은 무시', () => {
    const text =
      '안녕하세요.\n다음과 같이 동작합니다.\n```\n서버 X 입니다\n도메인 Y 입니다\n포트 Z 입니다\n```\n끝.';
    const r = run(
      ['guard', 'run', 'assertion'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: text }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe('semo guard run url-validator', () => {
  it('빈 입력 → exit 0', () => {
    const r = run(['guard', 'run', 'url-validator'], '');
    expect(r.code).toBe(0);
  });

  it('BOT_CWD 미설정 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'url-validator'],
      JSON.stringify({ cwd: NON_BOT_CWD, last_assistant_message: 'https://evil.example.com' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('URL 없음 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'url-validator'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: '평범한 텍스트' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('화이트리스트 도메인 (github.com) → exit 0', () => {
    const r = run(
      ['guard', 'run', 'url-validator'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: '참고: https://github.com/foo/bar',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('화이트리스트 서브도메인 (foo.vercel.app) → exit 0', () => {
    const r = run(
      ['guard', 'run', 'url-validator'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: 'https://foo.vercel.app',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('비화이트리스트 도메인 → exit 1 + BLOCK', () => {
    const r = run(
      ['guard', 'run', 'url-validator'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: '참고: https://evil.example.com/path',
      }),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('URL-GUARD');
    expect(r.stdout).toContain('evil.example.com');
  });

  it('코드블록 안 URL 은 검증 제외', () => {
    const r = run(
      ['guard', 'run', 'url-validator'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: '예시:\n```\ncurl https://evil.example.com\n```',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe('semo guard run kb-first', () => {
  it('빈 입력 → exit 0', () => {
    const r = run(['guard', 'run', 'kb-first'], '');
    expect(r.code).toBe(0);
  });

  it('BOT_CWD 미설정 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'kb-first'],
      JSON.stringify({ cwd: NON_BOT_CWD, last_assistant_message: '팀원 현황은 ...' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('KB topic 키워드 없음 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'kb-first'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: '안녕하세요. 그냥 잡담입니다.' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('KB topic + 흔적 없음 → WARN', () => {
    const r = run(
      ['guard', 'run', 'kb-first'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: '팀원 현황은 다음과 같습니다.',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('WARN: KB 관련 응답');
  });

  it('KB topic + 응답에 KB 흔적 (semo kb) → 통과', () => {
    const r = run(
      ['guard', 'run', 'kb-first'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: 'semo kb get team 으로 확인한 팀원 현황입니다.',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe('semo guard run decision-reminder', () => {
  it('빈 입력 → exit 0', () => {
    const r = run(['guard', 'run', 'decision-reminder'], '');
    expect(r.code).toBe(0);
  });

  it('decision keyword 없음 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'decision-reminder'],
      JSON.stringify({ cwd: BOT_CWD, last_assistant_message: '평범한 답변입니다.' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('이미 KB 기록 중 (semo kb upsert) → exit 0', () => {
    const r = run(
      ['guard', 'run', 'decision-reminder'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: '도입했습니다. 변경했고 semo kb upsert 로 기록했습니다.',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('dismiss 패턴 (KB 기록 불필요) → exit 0', () => {
    const r = run(
      ['guard', 'run', 'decision-reminder'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: '도입했습니다. 다만 KB 기록 불필요한 임시 변경입니다.',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('decision keyword + 흔적 없음 → BLOCK JSON', () => {
    const r = run(
      ['guard', 'run', 'decision-reminder'],
      JSON.stringify({
        cwd: BOT_CWD,
        last_assistant_message: '배포했습니다. 마이그레이션도 적용했습니다.',
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"decision":"block"');
    expect(r.stdout).toContain('DECISION REMINDER');
    expect(r.stdout).toContain('배포했');
  });
});

describe('semo guard run context-router', () => {
  it('빈 입력 → exit 0', () => {
    const r = run(['guard', 'run', 'context-router'], '');
    expect(r.code).toBe(0);
  });

  it('user_message 없음 → exit 0', () => {
    const r = run(['guard', 'run', 'context-router'], JSON.stringify({ cwd: BOT_CWD }));
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('KB 키워드 (팀원/누구) + 봇 cwd → KB-FIRST hint', () => {
    const r = run(
      ['guard', 'run', 'context-router'],
      JSON.stringify({ cwd: BOT_CWD, user_message: '팀원 누구 담당이야?' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('KB-FIRST');
  });

  it('KB 키워드 but 비봇 cwd → KB hint 제외', () => {
    const r = run(
      ['guard', 'run', 'context-router'],
      JSON.stringify({ cwd: NON_BOT_CWD, user_message: '팀원 누구야?' }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain('KB-FIRST');
  });

  it('SEMO_HOME env 로 conf path override 가능 (OSS portable)', () => {
    // SEMO_HOME 이 비어있으면 ~/.semo 사용 — 이 환경에서는 실 conf 가 있어 KB-FIRST 출력됨
    // 빈 디렉토리로 SEMO_HOME 설정 시 conf 없어 hint 미출력
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-home-'));
    try {
      const stdout = execFileSync('node', [CLI, 'guard', 'run', 'context-router'], {
        input: JSON.stringify({ cwd: BOT_CWD, user_message: '팀원 누구야?' }),
        encoding: 'utf8',
        env: { ...process.env, SEMO_HOME: tmp },
      });
      expect(stdout).toBe('');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('semo guard run skill-mirror', () => {
  it('Edit + bot mirror SKILL.md 경로 → WARN', () => {
    const r = run(
      ['guard', 'run', 'skill-mirror'],
      JSON.stringify({
        tool_name: 'Edit',
        tool_input: { file_path: '/Users/x/.claude/semo/bots/semiclaw/skills/kb-manager/SKILL.md' },
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('semo skill edit kb-manager');
  });

  it('다른 도구 (Bash) → exit 0', () => {
    const r = run(
      ['guard', 'run', 'skill-mirror'],
      JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('mirror 외 경로 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'skill-mirror'],
      JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: '/tmp/foo.md' } }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe('semo guard run destructive', () => {
  it('빈 입력 → exit 0', () => {
    const r = run(['guard', 'run', 'destructive'], '');
    expect(r.code).toBe(0);
  });

  it('비봇 cwd → exit 0', () => {
    const r = run(
      ['guard', 'run', 'destructive'],
      JSON.stringify({ cwd: NON_BOT_CWD, tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('Bash 외 도구 → exit 0', () => {
    const r = run(
      ['guard', 'run', 'destructive'],
      JSON.stringify({ cwd: BOT_CWD, tool_name: 'Read', tool_input: {} }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('rm -rf /etc → deny JSON', () => {
    const r = run(
      ['guard', 'run', 'destructive'],
      JSON.stringify({
        cwd: BOT_CWD,
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /etc' },
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"decision":"deny"');
    expect(r.stdout).toContain('rm -rf');
  });

  it('git push --force → deny', () => {
    const r = run(
      ['guard', 'run', 'destructive'],
      JSON.stringify({
        cwd: BOT_CWD,
        tool_name: 'Bash',
        tool_input: { command: 'git push --force origin main' },
      }),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('git push --force');
  });

  it('일반 명령 (ls) → exit 0', () => {
    const r = run(
      ['guard', 'run', 'destructive'],
      JSON.stringify({
        cwd: BOT_CWD,
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
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
