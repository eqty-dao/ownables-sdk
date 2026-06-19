#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    fail(`Failed to execute ${cmd}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasValidWasmHeader(path) {
  const header = readFileSync(path).subarray(0, 4);
  return (
    header.length === 4 &&
    header[0] === 0x00 &&
    header[1] === 0x61 &&
    header[2] === 0x73 &&
    header[3] === 0x6d
  );
}

function ensureWorkspaceMember(name) {
  const workspacePath = './ownables/Cargo.toml';
  const dir = `./ownables/${name}`;

  if (!existsSync(join(dir, 'Cargo.toml')) && !existsSync(join(dir, 'Cargo.yaml'))) {
    return;
  }

  if (!existsSync(workspacePath)) {
    return;
  }

  const content = readFileSync(workspacePath, 'utf8');
  const memberPattern = new RegExp(`"${escapeRegExp(name)}"`);
  if (memberPattern.test(content)) {
    return;
  }

  const lines = content.split(/\r?\n/);
  let inWorkspace = false;
  let inMembers = false;
  let inserted = false;
  const output = [];

  for (const line of lines) {
    if (/^\[workspace\]/.test(line)) {
      inWorkspace = true;
    }

    if (inWorkspace && !inMembers && /^[\t ]*members[\t ]*=[\t ]*\[/.test(line)) {
      inMembers = true;
      output.push(line);
      continue;
    }

    if (inMembers && /^[\t ]*\]/.test(line)) {
      output.push(`  \"${name}\",`);
      output.push(line);
      inMembers = false;
      inserted = true;
      continue;
    }

    output.push(line);
  }

  if (!inserted) {
    fail(`Unable to insert workspace member '${name}' in ${workspacePath}`);
  }

  writeFileSync(workspacePath, output.join('\n'));
}

function findPackageField(cargoToml, field) {
  const packageBlock = cargoToml.match(/\[package\][\s\S]*?(?=\n\[|$)/);
  if (!packageBlock) {
    return null;
  }

  const fieldRegex = new RegExp(`^${field}\\s*=\\s*\"([^\"]+)\"`, 'm');
  return packageBlock[0].match(fieldRegex)?.[1] ?? null;
}

function buildPackage(name) {
  const dir = `./ownables/${name}`;
  ensureWorkspaceMember(name);

  const cargoTomlPath = join(dir, 'Cargo.toml');

  if (existsSync(cargoTomlPath)) {
    const cargoToml = readFileSync(cargoTomlPath, 'utf8');
    const packageName = findPackageField(cargoToml, 'name');
    const packageVersion = findPackageField(cargoToml, 'version');
    const packageDescription = findPackageField(cargoToml, 'description') ?? '';

    if (!packageName || !packageVersion) {
      fail(`Unable to determine package name/version from ${cargoTomlPath}`);
    }

    const crateName = packageName.replaceAll('-', '_');
    const wasmPath = `./ownables/target/wasm32-unknown-unknown/release/${crateName}.wasm`;

    rmSync(join(dir, 'pkg'), { recursive: true, force: true });
    mkdirSync(join(dir, 'pkg'), { recursive: true });

    run('cargo', ['build', '-p', packageName, '--target', 'wasm32-unknown-unknown', '--release'], {
      cwd: './ownables',
    });

    if (!hasValidWasmHeader(wasmPath)) {
      fail(`Built wasm is invalid: ${wasmPath}`);
    }

    cpSync(wasmPath, join(dir, 'pkg', 'ownable_bg.wasm'));

    if (!hasValidWasmHeader(join(dir, 'pkg', 'ownable_bg.wasm'))) {
      fail(`Packaged wasm is invalid: ${join(dir, 'pkg', 'ownable_bg.wasm')}`);
    }

    const packageJson = {
      name: packageName,
      version: packageVersion,
      description: packageDescription,
      ownablesAbi: '1',
      wireFormat: 'cbor',
    };

    writeFileSync(join(dir, 'pkg', 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

    run('cargo', ['schema'], { cwd: dir });

    const schemaFiles = readdirSync(join(dir, 'schema'))
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => join(dir, 'schema', entry));

    run('zip', [
      '-r',
      '-j',
      `./ownables/${name}.zip`,
      join(dir, 'assets'),
      join(dir, 'pkg', 'ownable_bg.wasm'),
      join(dir, 'pkg', 'package.json'),
      ...schemaFiles,
    ]);
    return;
  }

  const entries = readdirSync(dir).map((entry) => join(dir, entry));
  run('zip', ['-r', '-j', `./ownables/${name}.zip`, ...entries]);
}

const arg = process.argv[2];

if (arg) {
  buildPackage(arg);
} else {
  const directories = readdirSync('./ownables', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== 'target');

  for (const name of directories) {
    buildPackage(basename(name));
  }
}
