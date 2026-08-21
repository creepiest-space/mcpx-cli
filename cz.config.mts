import { definePrompt } from 'czg';

export default definePrompt({
  maxSubjectLength: 100,
  scopes: ['package', 'cli', 'deps', 'ci', 'release'],
  allowCustomScopes: true,
  allowEmptyScopes: true,
  types: [
    { value: 'feat', name: 'feat:     New feature' },
    { value: 'fix', name: 'fix:      Bug fix' },
    { value: 'refactor', name: 'refactor: Refactoring' },
    { value: 'perf', name: 'perf:     Performance' },
    { value: 'test', name: 'test:     Tests' },
    { value: 'docs', name: 'docs:     Documentation' },
    { value: 'build', name: 'build:    Build system' },
    { value: 'ci', name: 'ci:       CI/CD' },
    { value: 'chore', name: 'chore:    Maintenance' },
    { value: 'style', name: 'style:    Non-functional style changes' },
    { value: 'revert', name: 'revert:   Revert a change' },
  ],
});
