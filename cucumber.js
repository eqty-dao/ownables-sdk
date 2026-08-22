import { isAgentEnvironment, loadLetsrunitEnv, resolveDebugWorldParameters } from '@letsrunit/cucumber/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const runtimeEnvPath = resolve('.e2e-runtime.json');
if (existsSync(runtimeEnvPath)) {
  Object.assign(process.env, JSON.parse(readFileSync(runtimeEnvPath, 'utf8')));
}

loadLetsrunitEnv();

const { failFast, worldParameters } = resolveDebugWorldParameters({
  argv: process.argv,
  baseWorldParameters: {
    baseURL: process.env.LETSRUNIT_BASE_URL ?? 'http://127.0.0.1:3300',
  },
});

const format = [
  isAgentEnvironment(process.env)
    ? '@letsrunit/cucumber/agent'
    : '@letsrunit/cucumber/progress',
];

export default {
  import: ['features/support/*.ts'],
  tags: 'not @broken',
  format,
  failFast,
  // Disabled while LetsRunIt investigates its recorder locking a new SQLite
  // database in agent environments. CI already runs without this plugin.
  plugin: [],
  worldParameters,
  letsrunit: {
    ignore: ['features/support/world.ts'],
  },
};
