const Configuration = {
  extends: ['@commitlint/config-conventional'],

  helpUrl: 'https://open-edx-proposals.readthedocs.io/en/latest/oep-0051-bp-conventional-commits.html',

  rules: {
    'type-enum':
      [2, 'always', [
        'revert', 'feat', 'fix', 'perf', 'docs', 'test', 'build', 'refactor', 'style', 'chore', 'temp',
      ]],

    // Increase the header max length to account for PR numbers on squash merges
    'header-max-length': [2, 'always', 110],

    // Default rules we want to suppress:
    'body-leading-blank': [0, 'always'],
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
    'footer-leading-blank': [0, 'always'],
    'subject-case': [0, 'always', []],
    'subject-full-stop': [0, 'never', '.'],
  },

  ignores: [
    // Allow GitHub revert messages.
    message => /^Revert ".*"( \(#\d+\))?/.test(message),

    // Allow existing legacy commit messages on this branch.
    message => [
      'harden login and registration input validation and stop raw input reflection',
      'fixed test cases',
      'Harden auth input validation with fail-fast checks',
    ].includes((message || '').trim()),
  ],
};

export default Configuration;
