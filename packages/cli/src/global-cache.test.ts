import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { applyTenantOverlay } from './global-cache.js';

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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-overlay-'));
  tmpDirs.push(d);
  return d;
}

describe('applyTenantOverlay', () => {
  it('tenant/skills/{name} 가 merged/skills/{name} 을 통째로 덮어씀', () => {
    const merged = mkTmp();
    const tenant = mkTmp();

    // kernel 측: 두 개 스킬 미리 존재
    fs.mkdirSync(path.join(merged, 'skills', 'foo'), { recursive: true });
    fs.writeFileSync(path.join(merged, 'skills', 'foo', 'SKILL.md'), 'kernel foo');
    fs.mkdirSync(path.join(merged, 'skills', 'bar'), { recursive: true });
    fs.writeFileSync(path.join(merged, 'skills', 'bar', 'SKILL.md'), 'kernel bar');

    // tenant 측: foo 만 override, baz 는 신규
    fs.mkdirSync(path.join(tenant, 'skills', 'foo'), { recursive: true });
    fs.writeFileSync(path.join(tenant, 'skills', 'foo', 'SKILL.md'), 'tenant foo');
    fs.mkdirSync(path.join(tenant, 'skills', 'baz'), { recursive: true });
    fs.writeFileSync(path.join(tenant, 'skills', 'baz', 'SKILL.md'), 'tenant baz');

    const count = applyTenantOverlay(merged, tenant);
    expect(count).toBe(2);

    expect(fs.readFileSync(path.join(merged, 'skills', 'foo', 'SKILL.md'), 'utf8')).toBe(
      'tenant foo',
    );
    expect(fs.readFileSync(path.join(merged, 'skills', 'bar', 'SKILL.md'), 'utf8')).toBe(
      'kernel bar',
    );
    expect(fs.readFileSync(path.join(merged, 'skills', 'baz', 'SKILL.md'), 'utf8')).toBe(
      'tenant baz',
    );
  });

  it('commands 는 folder/name.md 파일 단위 복사', () => {
    const merged = mkTmp();
    const tenant = mkTmp();

    fs.mkdirSync(path.join(merged, 'commands', 'pm'), { recursive: true });
    fs.writeFileSync(path.join(merged, 'commands', 'pm', 'plan.md'), 'kernel plan');
    fs.writeFileSync(path.join(merged, 'commands', 'pm', 'status.md'), 'kernel status');

    fs.mkdirSync(path.join(tenant, 'commands', 'pm'), { recursive: true });
    fs.writeFileSync(path.join(tenant, 'commands', 'pm', 'plan.md'), 'tenant plan');

    const count = applyTenantOverlay(merged, tenant);
    expect(count).toBe(1);
    expect(fs.readFileSync(path.join(merged, 'commands', 'pm', 'plan.md'), 'utf8')).toBe(
      'tenant plan',
    );
    expect(fs.readFileSync(path.join(merged, 'commands', 'pm', 'status.md'), 'utf8')).toBe(
      'kernel status',
    );
  });

  it('agents 도 통째로 덮어씀', () => {
    const merged = mkTmp();
    const tenant = mkTmp();

    fs.mkdirSync(path.join(merged, 'agents', 'planclaw'), { recursive: true });
    fs.writeFileSync(path.join(merged, 'agents', 'planclaw', 'planclaw.md'), 'kernel defn');
    fs.writeFileSync(
      path.join(merged, 'agents', 'planclaw', 'extra.md'),
      'kernel extra — should disappear',
    );

    fs.mkdirSync(path.join(tenant, 'agents', 'planclaw'), { recursive: true });
    fs.writeFileSync(path.join(tenant, 'agents', 'planclaw', 'planclaw.md'), 'tenant defn');

    applyTenantOverlay(merged, tenant);

    expect(fs.readFileSync(path.join(merged, 'agents', 'planclaw', 'planclaw.md'), 'utf8')).toBe(
      'tenant defn',
    );
    // tenant 에 없는 extra.md 는 kernel 에서 왔더라도 제거됨 (full replace per entry)
    expect(fs.existsSync(path.join(merged, 'agents', 'planclaw', 'extra.md'))).toBe(false);
  });

  it('tenant 디렉터리가 없으면 0 overlay', () => {
    const merged = mkTmp();
    const tenant = mkTmp();
    // 빈 tenant
    expect(applyTenantOverlay(merged, tenant)).toBe(0);
  });
});
