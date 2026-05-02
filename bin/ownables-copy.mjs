#!/usr/bin/env node

import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  fail('Usage: yarn ownables:copy <from> <to>');
}

const [from, to] = args;
const srcDir = `./ownables/${from}`;
const dstDir = `./ownables/${to}`;

if (!existsSync(srcDir)) {
  fail(`Source ownable does not exist: ${srcDir}`);
}

if (existsSync(dstDir)) {
  fail(`Destination already exists: ${dstDir}`);
}

cpSync(srcDir, dstDir, { recursive: true });

const cargoTomlPath = join(dstDir, 'Cargo.toml');
const schemaRsPath = join(dstDir, 'examples', 'schema.rs');
const workspaceTomlPath = './ownables/Cargo.toml';

if (existsSync(cargoTomlPath)) {
  const cargoToml = readFileSync(cargoTomlPath, 'utf8');
  const newPackageName = to.startsWith('ownable-') ? to : `ownable-${to}`;

  const packageBlock = cargoToml.match(/\[package\][\s\S]*?(?=\n\[|$)/);
  if (!packageBlock) {
    fail(`Unable to determine package name in: ${cargoTomlPath}`);
  }

  const oldPackageName = packageBlock[0].match(/^name\s*=\s*\"([^\"]+)\"/m)?.[1];
  if (!oldPackageName) {
    fail(`Unable to determine package name in: ${cargoTomlPath}`);
  }

  const updatedCargoToml = cargoToml.replace(
    /(\[package\][\s\S]*?^name\s*=\s*)\"[^\"]+\"/m,
    `$1\"${newPackageName}\"`,
  );

  if (updatedCargoToml === cargoToml) {
    fail(`Unable to update package name in: ${cargoTomlPath}`);
  }

  writeFileSync(cargoTomlPath, updatedCargoToml);

  if (existsSync(schemaRsPath)) {
    const oldCrateName = oldPackageName.replaceAll('-', '_');
    const newCrateName = newPackageName.replaceAll('-', '_');
    const schemaRs = readFileSync(schemaRsPath, 'utf8');

    const updatedSchemaRs = schemaRs
      .replace(new RegExp(`^use ${oldCrateName}::msg::`, 'm'), `use ${newCrateName}::msg::`)
      .replace(new RegExp(`^use ${oldCrateName}::state::`, 'm'), `use ${newCrateName}::state::`);

    writeFileSync(schemaRsPath, updatedSchemaRs);
  }
}

if (existsSync(workspaceTomlPath)) {
  const workspaceToml = readFileSync(workspaceTomlPath, 'utf8');
  const escapedTo = escapeRegExp(to);

  if (!new RegExp(`\"${escapedTo}\"`).test(workspaceToml)) {
    const lines = workspaceToml.split(/\r?\n/);
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
        output.push(`  \"${to}\",`);
        output.push(line);
        inMembers = false;
        inserted = true;
        continue;
      }

      output.push(line);
    }

    if (!inserted) {
      fail(`Unable to insert workspace member '${to}' in ${workspaceTomlPath}`);
    }

    writeFileSync(workspaceTomlPath, output.join('\n'));
  }
}

console.log(`Copied ${from} -> ${to}`);
