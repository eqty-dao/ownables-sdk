import { resolveDebugWorldParameters } from '@letsrunit/cucumber/config';

const { failFast, worldParameters } = resolveDebugWorldParameters({
  argv: process.argv,
  baseWorldParameters: {
    baseURL: 'http://localhost:3000',
  },
});

const format = process.env['CODEX_CI'] ? '@letsrunit/cucumber/agent' : '@letsrunit/cucumber/progress';

export default {
  require: ['features/support/**/*.js'],
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
    ignore: ['features/support/world.js'],
  },
};

