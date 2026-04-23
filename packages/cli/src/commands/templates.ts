/**
 * `semo templates` — builtin bot template catalog 조회.
 *
 * 실제 bot 생성은 `semo agent-factory create --template <id>` 또는
 * `semo factory apply "<자연어>"` 로 수행.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { defaultTemplateCatalog, type BotTemplate } from '@team-semicolon/semo-common';

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function formatTemplate(t: BotTemplate, verbose = false): string {
  const lines = [
    `${chalk.bold.cyan(t.id)} ${chalk.gray('—')} ${chalk.bold(t.name)}`,
    `  ${t.summary}`,
  ];
  if (verbose) {
    lines.push(
      '',
      `  ${chalk.gray('역할:')}    ${t.role}`,
      `  ${chalk.gray('KB 도메인:')} ${t.kbDomains.join(', ')}`,
      `  ${chalk.gray('스킬:')}    ${t.suggestedSkills.join(', ')}`,
      `  ${chalk.gray('태그:')}    ${t.tags.join(', ')}`,
    );
    if (t.slackIcon) lines.push(`  ${chalk.gray('아이콘:')}  ${t.slackIcon}`);
  }
  return lines.join('\n');
}

export function registerTemplatesCommand(program: Command): void {
  const cmd = program
    .command('templates')
    .description('봇 템플릿 카탈로그 조회 (builtin L0 kernel asset)');

  cmd
    .command('list')
    .description('모든 builtin 템플릿 1줄 요약')
    .option('--json', 'JSON 출력')
    .action((opts: { json?: boolean }) => {
      const templates = defaultTemplateCatalog.list();
      if (opts.json) {
        console.log(JSON.stringify(templates, null, 2));
        return;
      }
      console.log(chalk.cyan.bold(`\n📚 Bot Templates (${templates.length})\n`));
      for (const t of templates) {
        console.log(formatTemplate(t));
        console.log('');
      }
      console.log(chalk.gray('자세히: semo templates show <id>'));
      console.log(
        chalk.gray(
          '적용:   semo agent-factory create --template <id> --id <new-id> --role "<설명>"',
        ),
      );
    });

  cmd
    .command('show <id>')
    .description('특정 템플릿 상세 보기')
    .option('--json', 'JSON 출력')
    .action((id: string, opts: { json?: boolean }) => {
      const t = defaultTemplateCatalog.get(id);
      if (!t) {
        console.error(chalk.red(`✖ 템플릿 "${id}" 없음. list 로 확인하세요.`));
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify(t, null, 2));
        return;
      }
      console.log('');
      console.log(formatTemplate(t, true));
      console.log('');
      console.log(chalk.gray('적용 예:'));
      console.log(
        `  semo agent-factory create --id ${t.id} --role "${truncate(t.role, 60)}" --template ${t.id}`,
      );
    });

  cmd
    .command('search <query>')
    .description('ID/태그/이름/역할 중 키워드 매칭 (한영 혼용)')
    .option('--json', 'JSON 출력')
    .option('--top <n>', 'top N (default 5)', '5')
    .action((query: string, opts: { json?: boolean; top?: string }) => {
      const results = defaultTemplateCatalog.search(query);
      const top = parseInt(opts.top ?? '5', 10);
      const sliced = results.slice(0, isNaN(top) ? 5 : top);
      if (opts.json) {
        console.log(JSON.stringify(sliced, null, 2));
        return;
      }
      if (sliced.length === 0) {
        console.log(chalk.gray(`매칭 결과 없음: "${query}"`));
        return;
      }
      console.log(chalk.cyan.bold(`\n🔎 "${query}" 매칭 (${sliced.length}/${results.length})\n`));
      for (const r of sliced) {
        console.log(formatTemplate(r.template));
        console.log(chalk.gray(`  매칭: ${r.matchedBy.join(', ')} (score ${r.score})`));
        console.log('');
      }
    });
}

export const __testables = { formatTemplate, truncate };
