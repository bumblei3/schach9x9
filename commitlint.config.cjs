module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only
        'style', // Code style (formatting, semicolons, etc)
        'refactor', // Code restructuring without behavior change
        'perf', // Performance improvement
        'test', // Adding missing tests
        'chore', // Maintenance, build process, deps
        'ci', // CI/CD changes
        'build', // Build system changes
        'revert', // Reverts a previous commit
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    // Subject-Groesse wird nicht erzwungen: die Historie wechselt zwischen
    // Gross- und Kleinschreibung, ein 'sentence-case'-Regel draenge halbe der
    // vorhandenen Commits umzuschreiben. Dependabot betrifft das ohnehin nie.
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    // Dependabot commit bodies exceed 100 chars by design (release notes,
    // updated-dependency metadata) — enforcing this only breaks dep PRs.
    'body-max-line-length': [0],
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],
  },
};
