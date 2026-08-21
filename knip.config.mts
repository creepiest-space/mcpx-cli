import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: ['index.ts', 'cz.config.mts'],
    },
    'apps/*': {},
    'packages/*': {},
  },
};

export default config;
