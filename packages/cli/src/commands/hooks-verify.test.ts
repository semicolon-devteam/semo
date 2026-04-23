import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import {
  buildManifest,
  verifyManifest,
  listHookFiles,
  defaultHooksDir,
  defaultManifestPath,
} from './hooks-verify.js';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop()!;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function mkTmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-hooks-'));
  tmpDirs.push(d);
  return d;
}

describe('hooks-verify — buildManifest', () => {
  it('해시는 sha256: 접두어 + 64-hex', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'a.sh'), 'echo a');
    const m = buildManifest(dir);
    expect(m.version).toBe('1');
    expect(m.files['a.sh']).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('같은 내용의 파일은 같은 해시', () => {
    const d1 = mkTmp();
    const d2 = mkTmp();
    fs.writeFileSync(path.join(d1, 'x.sh'), 'same');
    fs.writeFileSync(path.join(d2, 'x.sh'), 'same');
    expect(buildManifest(d1).files['x.sh']).toBe(buildManifest(d2).files['x.sh']);
  });

  it('dotfile 무시', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'a.sh'), 'a');
    fs.writeFileSync(path.join(dir, '.hidden'), 'secret');
    const names = listHookFiles(dir);
    expect(names).toEqual(['a.sh']);
  });

  it('파일명이 정렬된 순서로 해싱됨', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'b.sh'), 'b');
    fs.writeFileSync(path.join(dir, 'a.sh'), 'a');
    fs.writeFileSync(path.join(dir, 'c.sh'), 'c');
    expect(listHookFiles(dir)).toEqual(['a.sh', 'b.sh', 'c.sh']);
  });
});

describe('hooks-verify — 기본 경로는 SEMO_HOME 준수', () => {
  it('defaultHooksDir 는 SEMO_HOME 하위를 반환', () => {
    const prev = process.env.SEMO_HOME;
    process.env.SEMO_HOME = '/tmp/sandbox-home';
    try {
      expect(defaultHooksDir()).toBe('/tmp/sandbox-home/shared/hooks');
    } finally {
      if (prev === undefined) delete process.env.SEMO_HOME;
      else process.env.SEMO_HOME = prev;
    }
  });

  it('defaultManifestPath 도 SEMO_HOME 기반', () => {
    const prev = process.env.SEMO_HOME;
    process.env.SEMO_HOME = '/tmp/sandbox-home';
    try {
      expect(defaultManifestPath()).toBe('/tmp/sandbox-home/shared/hooks-manifest.json');
    } finally {
      if (prev === undefined) delete process.env.SEMO_HOME;
      else process.env.SEMO_HOME = prev;
    }
  });
});

describe('hooks-verify — verifyManifest', () => {
  it('동일 디렉터리 → ok', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'a.sh'), 'a');
    fs.writeFileSync(path.join(dir, 'b.sh'), 'b');
    const m = buildManifest(dir);
    const res = verifyManifest(dir, m);
    expect(res.ok).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.extra).toEqual([]);
    expect(res.mismatched).toEqual([]);
  });

  it('파일 내용 변경 → mismatched', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'a.sh'), 'original');
    const m = buildManifest(dir);
    fs.writeFileSync(path.join(dir, 'a.sh'), 'tampered');
    const res = verifyManifest(dir, m);
    expect(res.ok).toBe(false);
    expect(res.mismatched).toEqual(['a.sh']);
  });

  it('manifest 에 있으나 디스크 삭제 → missing', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'a.sh'), 'a');
    fs.writeFileSync(path.join(dir, 'b.sh'), 'b');
    const m = buildManifest(dir);
    fs.rmSync(path.join(dir, 'b.sh'));
    const res = verifyManifest(dir, m);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual(['b.sh']);
  });

  it('manifest 에 없는 새 파일 → extra (ok 에는 영향 없음)', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'a.sh'), 'a');
    const m = buildManifest(dir);
    fs.writeFileSync(path.join(dir, 'new.sh'), 'new');
    const res = verifyManifest(dir, m);
    expect(res.ok).toBe(false);
    expect(res.extra).toEqual(['new.sh']);
    expect(res.mismatched).toEqual([]);
    expect(res.missing).toEqual([]);
  });

  it('missing + mismatched + extra 동시 발생', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'keep.sh'), 'keep');
    fs.writeFileSync(path.join(dir, 'change.sh'), 'v1');
    fs.writeFileSync(path.join(dir, 'gone.sh'), 'gone');
    const m = buildManifest(dir);
    fs.writeFileSync(path.join(dir, 'change.sh'), 'v2');
    fs.rmSync(path.join(dir, 'gone.sh'));
    fs.writeFileSync(path.join(dir, 'added.sh'), 'added');
    const res = verifyManifest(dir, m);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual(['gone.sh']);
    expect(res.mismatched).toEqual(['change.sh']);
    expect(res.extra).toEqual(['added.sh']);
  });
});
