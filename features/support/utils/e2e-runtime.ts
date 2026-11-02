import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadE2ERuntimeEnvironment(): void {
  const runtimeEnvPath = resolve('.e2e-runtime.json');
  if (existsSync(runtimeEnvPath)) {
    Object.assign(process.env, JSON.parse(readFileSync(runtimeEnvPath, 'utf8')));
  }
}
