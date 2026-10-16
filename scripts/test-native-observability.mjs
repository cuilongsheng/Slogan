import { readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
async function findJar(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isFile() && entry.name.endsWith('.jar')) return path;
    if (entry.isDirectory()) {
      const found = await findJar(path);
      if (found) return found;
    }
  }
}
const temp = await mkdtemp(`${tmpdir()}/slogan-native-canary-`);
try {
  const response = await fetch(
    'https://repo.maven.apache.org/maven2/org/json/json/20250517/json-20250517.jar',
  );
  if (!response.ok) throw new Error('Native canary JSON dependency unavailable');
  await writeFile(`${temp}/json.jar`, new Uint8Array(await response.arrayBuffer()));
  const cache = `${homedir()}/.gradle/caches/modules-2/files-2.1`;
  const classpath = [
    await findJar(`${cache}/io.sentry/sentry/8.60.0`),
    await findJar(`${cache}/org.jetbrains.kotlin/kotlin-stdlib/2.1.20`),
    `${temp}/json.jar`,
    `${root}apps/mobile/android/app/build/tmp/kotlin-classes/release`,
    `${process.env.ANDROID_HOME ?? `${homedir()}/Library/Android/sdk`}/platforms/android-36/android.jar`,
  ].join(':');
  for (const [command, args] of [
    [
      'javac',
      ['-cp', classpath, '-d', temp, `${root}scripts/tests/NativeObservabilityCanary.java`],
    ],
    ['java', ['-cp', `${temp}:${classpath}`, 'NativeObservabilityCanary', `${temp}/cache`]],
  ]) {
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Native canary verification failed');
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
