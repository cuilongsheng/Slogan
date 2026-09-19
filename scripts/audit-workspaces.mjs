import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workspacePaths = [
  'apps/admin',
  'apps/mobile',
  'apps/api',
  'packages/api-client',
  'packages/shared',
];

const expectedNames = new Set([
  '@slogan/admin',
  '@slogan/mobile',
  '@slogan/api',
  '@slogan/api-client',
  '@slogan/shared',
]);

const deferredPackages = new Set([
  '@tanstack/react-query',
  '@tanstack/react-table',
  'axios',
  'date-fns',
  'date-fns-tz',
  'i18next',
  'nativewind',
  'react-hook-form',
  'redux',
  'zustand',
]);

const manifests = [];
for (const workspacePath of workspacePaths) {
  const manifestPath = resolve(workspacePath, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifests.push({ manifestPath, manifest });
}

const errors = [];
for (const { manifestPath, manifest } of manifests) {
  if (!expectedNames.has(manifest.name)) {
    errors.push(`${manifestPath}: unexpected package name ${String(manifest.name)}`);
  }
  if (manifest.private !== true) {
    errors.push(`${manifestPath}: workspace package must be private`);
  }

  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      if (
        ['livekit-server-sdk', 'bullmq', 'ioredis'].includes(name) &&
        manifest.name !== '@slogan/api'
      ) {
        errors.push(
          `${manifestPath}: realtime backend dependency ${name} belongs only in @slogan/api`,
        );
      }
      if (deferredPackages.has(name)) {
        errors.push(`${manifestPath}: deferred package ${name} is installed in ${section}`);
      }
      if (name.startsWith('@slogan/') && !String(range).startsWith('workspace:')) {
        errors.push(`${manifestPath}: internal package ${name} must use workspace: protocol`);
      }
    }
  }
}

if (new Set(manifests.map(({ manifest }) => manifest.name)).size !== expectedNames.size) {
  errors.push('workspace package names must be unique');
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Workspace dependency audit passed.');
}
