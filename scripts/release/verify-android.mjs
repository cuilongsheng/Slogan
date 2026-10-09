import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { API_ORIGIN } from './deployment-gate.mjs';
const apk = resolve(
  process.argv[2] ?? 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
);
const sha = process.env.SLOGAN_RELEASE_COMMIT;
assert.match(sha ?? '', /^[a-f0-9]{40}$/, 'Release commit required');
const tools = join(
  process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? '',
  'build-tools',
  '36.0.0',
);
const signer = execFileSync(join(tools, 'apksigner'), ['verify', '--print-certs', apk], {
  encoding: 'utf8',
});
const certificate = signer.match(/certificate SHA-256 digest: ([a-f0-9]{64})/)?.[1];
assert.equal(
  certificate,
  'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c',
  'Signer changed; cannot publish upgrade',
);
const badging = execFileSync(join(tools, 'aapt2'), ['dump', 'badging', apk], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
});
const manifest = execFileSync(
  join(tools, 'aapt2'),
  ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml'],
  { encoding: 'utf8' },
);
assert.match(badging, /package: name='com\.slogan\.mobile'/);
assert.match(badging, /native-code: 'arm64-v8a'/);
assert.doesNotMatch(badging, /application-debuggable/);
const softInputMode = manifest.match(/windowSoftInputMode[^\n]*=0x([a-f0-9]+)/)?.[1];
assert.equal(
  parseInt(softInputMode ?? '', 16) & 0xf0,
  0x10,
  'Main activity must resize for keyboard',
);
const config = JSON.parse(
  execFileSync('unzip', ['-p', apk, 'assets/app.config'], { encoding: 'utf8' }),
);
assert.equal(config.extra?.release?.commit, sha);
assert.equal(config.extra?.release?.apiOrigin, API_ORIGIN);
assert.equal(config.android?.versionCode, Number(process.env.SLOGAN_ANDROID_VERSION_CODE));
assert(badging.includes(`versionCode='${config.android.versionCode}'`));
assert(badging.includes(`versionName='${config.version}'`));
let launcherResources = 0;
const resources = execFileSync(join(tools, 'aapt2'), ['dump', 'resources', apk], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground']) {
    const expected = await readFile(
      `apps/mobile/android/app/src/main/res/mipmap-${density}/${name}.webp`,
    );
    const section = resources.match(
      new RegExp(
        `resource 0x[0-9a-f]+ mipmap/${name}\\n([\\s\\S]*?)(?=\\n    resource |\\n  type |$)`,
      ),
    )?.[1];
    const packagedPath = section?.match(
      new RegExp(`\\(${density}\\) \\(file\\) (res/[^\\s]+\\.webp)`),
    )?.[1];
    assert(packagedPath, `Launcher resource missing: ${density}/${name}`);
    const packaged = execFileSync('unzip', ['-p', apk, packagedPath]);
    assert(expected.equals(packaged), `Launcher icon mismatch: ${density}/${name}`);
    launcherResources++;
  }
}
const bundle = execFileSync('unzip', ['-p', apk, 'assets/index.android.bundle'], {
  maxBuffer: 32 * 1024 * 1024,
});
assert(bundle.includes(Buffer.from(API_ORIGIN)), 'APK bundle API does not match production');
assert(
  bundle.includes(Buffer.from('voice-room-direct-entry-v2')),
  'APK is missing the current room UI',
);
const bytes = await readFile(apk);
const digest = createHash('sha256').update(bytes).digest('hex');
const metadata = {
  commit: sha,
  version: config.version,
  versionCode: config.android.versionCode,
  package: 'com.slogan.mobile',
  apiOrigin: API_ORIGIN,
  sha256: digest,
  bytes: bytes.length,
  abi: ['arm64-v8a'],
  signing: 'controlled-debug',
  certificateSha256: certificate,
  launcherResources,
  roomUiRevision: 'direct-entry-v2',
  builtAt: new Date().toISOString(),
  deviceVerified: false,
};
await mkdir('release-artifacts', { recursive: true });
await copyFile(apk, 'release-artifacts/slogan.apk');
await writeFile('release-artifacts/android-release.json', JSON.stringify(metadata, null, 2) + '\n');
await writeFile('release-artifacts/SHA256SUMS', `${digest}  slogan.apk\n`);
console.log(JSON.stringify(metadata));
