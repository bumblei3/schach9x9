export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0], // dependabot uses lowercase "ci(deps):" - disable
    'body-max-line-length': [0], // dependabot bodies exceed 100 chars by design
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'wip',
        'security',
      ],
    ],
  },
};
