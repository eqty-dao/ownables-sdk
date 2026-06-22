import { isAgentEnvironment, loadLetsrunitEnv, resolveDebugWorldParameters } from '@letsrunit/cucumber/config';

loadLetsrunitEnv();

const { failFast, worldParameters } = resolveDebugWorldParameters({
  argv: process.argv,
  baseWorldParameters: {
    baseURL: process.env.LETSRUNIT_BASE_URL ?? '${baseUrl}',
  },
});

const format = [
  isAgentEnvironment(process.env)
    ? '@letsrunit/cucumber/agent'
    : '@letsrunit/cucumber/progress',
];

export default {
  import: ['features/support/*.ts'],
  format,
  failFast,
  plugin: ['@letsrunit/cucumber/store'],
  pluginOptions: {
    letsrunitStore: {
      directory: '.letsrunit',
      enabled: process.env.CI !== 'true',
    },
  },
  worldParameters,
  letsrunit: {
    ignore: ['features/support/world.ts'],
  },
};
