import { resolveDebugWorldParameters } from '@letsrunit/cucumber/config';

const { failFast, worldParameters } = resolveDebugWorldParameters({
  argv: process.argv,
  baseWorldParameters: {
    baseURL: 'http://localhost:3000',
  },
});

export default {
  import: ['features/support/**/*.ts'],
  format: ['@letsrunit/cucumber/progress'],
  failFast,
  plugin: ['@letsrunit/cucumber/store'],
  pluginOptions: {
    letsrunitStore: {
      directory: '.letsrunit',
    },
  },
  worldParameters,
  letsrunit: {
    ignore: ['features/support/world.ts'],
  },
};
