import { readFile, appendFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { REPOSITORY, assertMain, assertRuntime } from './deployment-gate.mjs';
const metadata = JSON.parse(await readFile('release-artifacts/android-release.json', 'utf8'));
const sha = process.env.SLOGAN_RELEASE_COMMIT;
assert.equal(metadata.commit, sha);
assert.equal(
  createHash('sha256')
    .update(await readFile('release-artifacts/slogan.apk'))
    .digest('hex'),
  metadata.sha256,
);
await assertMain(sha);
await assertRuntime(sha);
const tag = `android-${sha}`;
const gh = (args) =>
  execFileSync('gh', args, {
    stdio: 'pipe',
    env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN },
    encoding: 'utf8',
  });
const notes = `Android ${metadata.version} (code ${metadata.versionCode})\n\nCommit: ${sha}\nAPI: ${metadata.apiOrigin}\nSHA-256: ${metadata.sha256}\nSigning: controlled installation, same existing debug certificate.\nDevice validation is performed by the user after installation.\n`;
await writeFile('release-artifacts/notes.md', notes);
let existing;
try {
  existing = JSON.parse(gh(['release', 'view', tag, '--repo', REPOSITORY, '--json', 'isDraft']));
} catch {
  /* Creation below fails visibly for auth/network problems. */
}
if (!existing)
  gh([
    'release',
    'create',
    tag,
    '--repo',
    REPOSITORY,
    '--target',
    sha,
    '--draft',
    '--title',
    `Android ${metadata.version}`,
    '--notes-file',
    'release-artifacts/notes.md',
  ]);
if (existing && !existing.isDraft) {
  const previous = await fetch(
    `https://github.com/${REPOSITORY}/releases/download/${tag}/android-release.json`,
    { signal: AbortSignal.timeout(30000) },
  );
  assert(previous.ok, 'Existing release metadata unavailable');
  assert.equal(
    (await previous.json()).sha256,
    metadata.sha256,
    'Published release is immutable; use a new commit',
  );
}
if (!existing || existing.isDraft)
  gh([
    'release',
    'upload',
    tag,
    '--repo',
    REPOSITORY,
    '--clobber',
    'release-artifacts/slogan.apk',
    'release-artifacts/android-release.json',
    'release-artifacts/SHA256SUMS',
  ]);
await assertMain(sha);
await assertRuntime(sha);
gh(['release', 'edit', tag, '--repo', REPOSITORY, '--draft=false', '--latest']);
const url = `https://github.com/${REPOSITORY}/releases/download/${tag}/android-release.json`;
let published;
for (let attempt = 0; attempt < 6; attempt++) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (response.ok) {
    published = await response.json();
    break;
  }
  if (![404, 429, 502, 503].includes(response.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
assert(published, 'Published metadata unavailable');
assert.equal(published.sha256, metadata.sha256);
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `\nAPK published: https://slogan-preview-mobile.pages.dev/downloads/android.apk\n\nRelease: https://github.com/${REPOSITORY}/releases/tag/${tag}\n\n${notes}`,
  );
console.log(`Published ${tag}; ${metadata.sha256}`);
