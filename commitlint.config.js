module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'ci', 'perf', 'style'],
    ],
    'subject-max-length': [2, 'always', 100],
  },
};
