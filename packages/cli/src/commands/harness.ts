/**
 * semo harness — 프로젝트 하네스 관리
 *
 * 결정론적 하네스(Husky, ESLint, Prettier, commitlint)를
 * 어떤 레포에서든 일관되게 적용·점검·갱신하는 CLI.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── 템플릿 경로 ──────────────────────────────────────────────
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'harness');

// ── 하네스 체크 항목 ─────────────────────────────────────────
interface CheckItem {
  name: string;
  check: (cwd: string) => boolean;
  fix?: string;
}

const CHECKS: CheckItem[] = [
  {
    name: 'Husky installed (.husky/)',
    check: (cwd) => fs.existsSync(path.join(cwd, '.husky')),
    fix: 'npx husky init',
  },
  {
    name: 'pre-commit hook (lint-staged)',
    check: (cwd) => {
      const f = path.join(cwd, '.husky', 'pre-commit');
      return fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('lint-staged');
    },
    fix: 'echo "npx lint-staged" > .husky/pre-commit',
  },
  {
    name: 'commit-msg hook (commitlint)',
    check: (cwd) => {
      const f = path.join(cwd, '.husky', 'commit-msg');
      return fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('commitlint');
    },
    fix: 'echo "npx --no -- commitlint --edit \\$1" > .husky/commit-msg',
  },
  {
    name: 'pre-push hook (lint + tsc)',
    check: (cwd) => {
      const f = path.join(cwd, '.husky', 'pre-push');
      return fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('lint');
    },
    fix: 'echo "npm run lint && npx tsc --noEmit" > .husky/pre-push',
  },
  {
    name: 'Prettier configured (.prettierrc)',
    check: (cwd) =>
      fs.existsSync(path.join(cwd, '.prettierrc')) ||
      fs.existsSync(path.join(cwd, '.prettierrc.json')) ||
      fs.existsSync(path.join(cwd, 'prettier.config.js')),
    fix: 'semo harness init',
  },
  {
    name: 'Prettier ignore (.prettierignore)',
    check: (cwd) => fs.existsSync(path.join(cwd, '.prettierignore')),
    fix: 'semo harness init',
  },
  {
    name: 'commitlint configured',
    check: (cwd) =>
      fs.existsSync(path.join(cwd, 'commitlint.config.js')) ||
      fs.existsSync(path.join(cwd, 'commitlint.config.ts')) ||
      fs.existsSync(path.join(cwd, '.commitlintrc.js')),
    fix: 'semo harness init',
  },
  {
    name: 'ESLint configured',
    check: (cwd) => {
      // Root-level config
      if (
        fs.existsSync(path.join(cwd, 'eslint.config.mjs')) ||
        fs.existsSync(path.join(cwd, 'eslint.config.js')) ||
        fs.existsSync(path.join(cwd, '.eslintrc.js')) ||
        fs.existsSync(path.join(cwd, '.eslintrc.json'))
      )
        return true;
      // Monorepo: check packages/*/eslint.config.*
      const pkgsDir = path.join(cwd, 'packages');
      if (fs.existsSync(pkgsDir)) {
        const dirs = fs.readdirSync(pkgsDir, { withFileTypes: true });
        return dirs.some(
          (d) =>
            d.isDirectory() &&
            (fs.existsSync(path.join(pkgsDir, d.name, 'eslint.config.mjs')) ||
              fs.existsSync(path.join(pkgsDir, d.name, 'eslint.config.js'))),
        );
      }
      return false;
    },
    fix: 'semo harness init',
  },
  {
    name: 'lint-staged configured',
    check: (cwd) => {
      const pkgPath = path.join(cwd, 'package.json');
      if (!fs.existsSync(pkgPath)) return false;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return !!pkg['lint-staged'];
    },
    fix: 'semo harness init',
  },
  {
    name: 'PR Quality Gate workflow',
    check: (cwd) => {
      const dir = path.join(cwd, '.github', 'workflows');
      if (!fs.existsSync(dir)) return false;
      const files = fs.readdirSync(dir);
      return files.some(
        (f) =>
          f.includes('quality') ||
          (fs.existsSync(path.join(dir, f)) &&
            fs.readFileSync(path.join(dir, f), 'utf8').includes('tsc --noEmit')),
      );
    },
    fix: 'semo harness init',
  },
];

// ── 유틸 ─────────────────────────────────────────────────────

function copyTemplate(templateName: string, destPath: string): void {
  const src = path.join(TEMPLATES_DIR, templateName);
  if (!fs.existsSync(src)) {
    throw new Error(`Template not found: ${templateName}`);
  }
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, destPath);
}

function fileExists(cwd: string, ...segments: string[]): boolean {
  return fs.existsSync(path.join(cwd, ...segments));
}

function readPkg(cwd: string): Record<string, unknown> {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function writePkg(cwd: string, pkg: Record<string, unknown>): void {
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}

// ── 명령 등록 ────────────────────────────────────────────────

export function registerHarnessCommands(program: Command): void {
  const cmd = program
    .command('harness')
    .description('프로젝트 하네스 관리 — init / check / update');

  // ── semo harness init ──────────────────────────────────────
  cmd
    .command('init')
    .description('현재 레포에 하네스 스캐폴딩 (Husky, ESLint, Prettier, commitlint)')
    .option('--skip-install', 'npm install 건너뛰기')
    .option('--skip-eslint', 'ESLint 설정 건너뛰기 (기존 설정 있을 때)')
    .option('--skip-ci', 'GitHub Actions 워크플로우 건너뛰기')
    .action(async (options) => {
      const cwd = process.cwd();
      const spinner = ora();

      // 사전 조건 확인
      if (!fileExists(cwd, 'package.json')) {
        console.error(chalk.red('✗ package.json이 없습니다. npm init 먼저 실행하세요.'));
        process.exit(1);
      }
      if (!fileExists(cwd, '.git')) {
        console.error(chalk.red('✗ git 레포가 아닙니다. git init 먼저 실행하세요.'));
        process.exit(1);
      }

      console.log(chalk.bold('\n🔧 SEMO Harness 초기화\n'));

      // 1. devDependencies 설치
      if (!options.skipInstall) {
        spinner.start('devDependencies 설치 중...');
        try {
          execSync(
            'npm install -D husky lint-staged prettier @commitlint/cli @commitlint/config-conventional',
            { cwd, stdio: 'pipe' },
          );
          spinner.succeed('devDependencies 설치 완료');
        } catch (e) {
          spinner.fail('devDependencies 설치 실패');
          console.error(chalk.red(String(e)));
          process.exit(1);
        }
      }

      // 2. Husky 초기화
      spinner.start('Husky 초기화 중...');
      try {
        execSync('npx husky init', { cwd, stdio: 'pipe' });
        spinner.succeed('Husky 초기화 완료');
      } catch {
        // husky init은 이미 초기화되면 에러 — 무시
        spinner.succeed('Husky 이미 초기화됨');
      }

      // 3. Husky 훅 생성
      spinner.start('Git 훅 생성 중...');
      const huskyDir = path.join(cwd, '.husky');
      copyTemplate('pre-commit', path.join(huskyDir, 'pre-commit'));
      copyTemplate('commit-msg', path.join(huskyDir, 'commit-msg'));
      copyTemplate('pre-push', path.join(huskyDir, 'pre-push'));
      spinner.succeed('Git 훅 3개 생성 (pre-commit, commit-msg, pre-push)');

      // 4. 설정 파일 생성 (기존 파일이 없을 때만)
      spinner.start('설정 파일 생성 중...');
      const created: string[] = [];

      if (!fileExists(cwd, '.prettierrc') && !fileExists(cwd, '.prettierrc.json')) {
        copyTemplate('prettierrc.json', path.join(cwd, '.prettierrc'));
        created.push('.prettierrc');
      }
      if (!fileExists(cwd, '.prettierignore')) {
        copyTemplate('prettierignore', path.join(cwd, '.prettierignore'));
        created.push('.prettierignore');
      }
      if (!fileExists(cwd, 'commitlint.config.js') && !fileExists(cwd, 'commitlint.config.ts')) {
        copyTemplate('commitlint.config.js', path.join(cwd, 'commitlint.config.js'));
        created.push('commitlint.config.js');
      }
      spinner.succeed(`설정 파일 생성: ${created.length > 0 ? created.join(', ') : '(모두 존재)'}`);

      // 5. ESLint 설정 (기존 없을 때만)
      if (!options.skipEslint) {
        const hasEslint =
          fileExists(cwd, 'eslint.config.mjs') ||
          fileExists(cwd, 'eslint.config.js') ||
          fileExists(cwd, '.eslintrc.js') ||
          fileExists(cwd, '.eslintrc.json');

        if (!hasEslint) {
          spinner.start('ESLint 설정 생성 중...');
          try {
            execSync('npm install -D eslint @eslint/js typescript-eslint', {
              cwd,
              stdio: 'pipe',
            });
            copyTemplate('eslint.config.mjs', path.join(cwd, 'eslint.config.mjs'));
            spinner.succeed('ESLint 설정 생성 완료');
          } catch (e) {
            spinner.warn('ESLint 설정 생성 실패 — 수동 설정 필요');
          }
        } else {
          console.log(chalk.dim('  ℹ ESLint 설정 이미 존재 — 건너뜀'));
        }
      }

      // 6. lint-staged 설정 추가
      const pkg = readPkg(cwd);
      if (!pkg['lint-staged']) {
        spinner.start('lint-staged 설정 추가 중...');
        pkg['lint-staged'] = {
          '*.{ts,tsx,js,mjs}': ['prettier --write'],
          '*.{json,yml,yaml}': ['prettier --write'],
          '*.md': ['prettier --write'],
        };
        writePkg(cwd, pkg);
        spinner.succeed('lint-staged 설정 추가 완료');
      }

      // 7. prepare 스크립트 추가
      const scripts = (pkg['scripts'] as Record<string, string>) || {};
      if (!scripts['prepare']) {
        scripts['prepare'] = 'husky';
        pkg['scripts'] = scripts;
        writePkg(cwd, pkg);
      }

      // 8. GitHub Actions 워크플로우
      if (!options.skipCi) {
        const workflowDir = path.join(cwd, '.github', 'workflows');
        const hasQualityGate =
          fs.existsSync(workflowDir) &&
          fs.readdirSync(workflowDir).some((f) => f.includes('quality'));

        if (!hasQualityGate) {
          spinner.start('PR Quality Gate 워크플로우 생성 중...');
          copyTemplate('pr-quality-gate.yml', path.join(workflowDir, 'pr-quality-gate.yml'));
          spinner.succeed('PR Quality Gate 워크플로우 생성 완료');
        } else {
          console.log(chalk.dim('  ℹ PR Quality Gate 워크플로우 이미 존재 — 건너뜀'));
        }
      }

      // 완료 리포트
      console.log(chalk.bold.green('\n✅ 하네스 초기화 완료!\n'));
      console.log(chalk.dim('검증: semo harness check'));
      console.log(chalk.dim('갱신: semo harness update\n'));
    });

  // ── semo harness check ─────────────────────────────────────
  cmd
    .command('check')
    .description('현재 레포의 하네스 건강도 검사')
    .action(async () => {
      const cwd = process.cwd();
      console.log(chalk.bold('\n🔍 SEMO Harness 점검\n'));

      let passed = 0;
      let warned = 0;
      let failed = 0;

      for (const item of CHECKS) {
        const ok = item.check(cwd);
        if (ok) {
          console.log(chalk.green(`  ✅ ${item.name}`));
          passed++;
        } else {
          console.log(chalk.red(`  ❌ ${item.name}`));
          if (item.fix) {
            console.log(chalk.dim(`     Fix: ${item.fix}`));
          }
          failed++;
        }
      }

      const total = CHECKS.length;
      const score = Math.round((passed / total) * 10);
      const color = score >= 8 ? chalk.green : score >= 5 ? chalk.yellow : chalk.red;

      console.log(
        color(`\n  Score: ${score}/10 (${passed} passed, ${warned} warnings, ${failed} failed)\n`),
      );

      if (failed > 0) {
        console.log(chalk.yellow("  💡 Run 'semo harness init' to fix missing items.\n"));
      }
    });

  // ── semo harness update ────────────────────────────────────
  cmd
    .command('update')
    .description('하네스 설정을 최신 SEMO 표준으로 갱신')
    .option('--apply', '차이점 자동 적용')
    .option('--force', '기존 파일 강제 덮어쓰기')
    .action(async (options) => {
      const cwd = process.cwd();
      console.log(chalk.bold('\n🔄 SEMO Harness 업데이트 점검\n'));

      const targets: { template: string; dest: string; label: string }[] = [
        {
          template: 'pre-commit',
          dest: path.join('.husky', 'pre-commit'),
          label: 'pre-commit hook',
        },
        {
          template: 'commit-msg',
          dest: path.join('.husky', 'commit-msg'),
          label: 'commit-msg hook',
        },
        {
          template: 'pre-push',
          dest: path.join('.husky', 'pre-push'),
          label: 'pre-push hook',
        },
        { template: 'prettierrc.json', dest: '.prettierrc', label: 'Prettier config' },
        { template: 'prettierignore', dest: '.prettierignore', label: 'Prettier ignore' },
        {
          template: 'commitlint.config.js',
          dest: 'commitlint.config.js',
          label: 'commitlint config',
        },
      ];

      let diffs = 0;

      for (const t of targets) {
        const templatePath = path.join(TEMPLATES_DIR, t.template);
        const destPath = path.join(cwd, t.dest);

        if (!fs.existsSync(templatePath)) continue;

        const templateContent = fs.readFileSync(templatePath, 'utf8');

        if (!fs.existsSync(destPath)) {
          console.log(chalk.yellow(`  ⚠ ${t.label}: 파일 없음`));
          if (options.apply || options.force) {
            const dir = path.dirname(destPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(destPath, templateContent);
            console.log(chalk.green(`    → 생성됨`));
          }
          diffs++;
          continue;
        }

        const currentContent = fs.readFileSync(destPath, 'utf8');
        if (currentContent.trim() !== templateContent.trim()) {
          console.log(chalk.yellow(`  ⚠ ${t.label}: 표준과 다름`));
          if (options.apply || options.force) {
            fs.writeFileSync(destPath, templateContent);
            console.log(chalk.green(`    → 갱신됨`));
          }
          diffs++;
        } else {
          console.log(chalk.green(`  ✅ ${t.label}: 최신`));
        }
      }

      if (diffs === 0) {
        console.log(chalk.green('\n  모든 설정이 최신 SEMO 표준과 일치합니다.\n'));
      } else if (!options.apply && !options.force) {
        console.log(
          chalk.yellow(`\n  ${diffs}개 항목 차이. 'semo harness update --apply'로 적용.\n`),
        );
      } else {
        console.log(chalk.green(`\n  ${diffs}개 항목 갱신 완료.\n`));
      }
    });
}
