const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
  withAppBuildGradle,
} = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Public ingest/build metadata only. Upload tokens are never written by this plugin.
module.exports = function withObservability(config, options = {}) {
  const enabled = options.enabled === true;
  const safe = {
    enabled,
    dsn: enabled ? options.dsn : '',
    environment: options.environment ?? 'development',
    release: options.release ?? '',
    build: options.build ?? '',
  };
  if (
    enabled &&
    (!/^https:\/\/[0-9a-f]{16,64}@(?:[a-z0-9-]+\.)*ingest(?:\.[a-z]+)?\.sentry\.io\/[0-9]+$/.test(
      safe.dsn ?? '',
    ) ||
      !/^slogan-mobile@[0-9a-f]{7,40}$/.test(safe.release) ||
      !/^[0-9a-f]{7,40}(?:\.[0-9]{1,12})?$/.test(safe.build) ||
      !['preview', 'production', 'test', 'development'].includes(safe.environment))
  )
    throw new Error('Invalid native observability configuration');
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    app['meta-data'] ??= [];
    app['meta-data'] = app['meta-data'].filter(
      (item) => item.$['android:name'] !== 'io.sentry.auto-init',
    );
    app['meta-data'].push({
      $: { 'android:name': 'io.sentry.auto-init', 'android:value': 'false' },
    });
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    if (!mod.modResults.contents.includes('SloganObservability.initialize(this)'))
      mod.modResults.contents = mod.modResults.contents.replace(
        'super.onCreate()',
        'super.onCreate()\n    SloganObservability.initialize(this)',
      );
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    const marker = '// Slogan observability symbols';
    const legacy =
      /\n\/\/ Slogan observability symbols\nif \(System\.getenv\('EXPO_PUBLIC_OBSERVABILITY_ENABLED'\) == 'true'\) \{\n {4}if \(!System\.getenv\('SENTRY_AUTH_TOKEN'\) \|\| !System\.getenv\('SENTRY_ORG'\) \|\| !System\.getenv\('SENTRY_PROJECT'\)\) throw new GradleException\('Missing observability upload configuration'\)\n\}\n/;
    mod.modResults.contents = mod.modResults.contents
      .replace(legacy, '')
      .replace(
        /\n\/\/ Slogan observability symbols[\s\S]*?\/\/ End Slogan observability symbols\n/g,
        '',
      );
    mod.modResults.contents += `\n${marker}
def sloganObservability = new groovy.json.JsonSlurper().parse(file('src/main/assets/slogan.observability.json'))
if (sloganObservability.enabled != (System.getenv('EXPO_PUBLIC_OBSERVABILITY_ENABLED') == 'true')) {
    throw new GradleException('Observability prebuild and release configuration differ')
}
if (sloganObservability.enabled) {
    if (!System.getenv('SENTRY_AUTH_TOKEN') || !System.getenv('SENTRY_ORG') || !System.getenv('SENTRY_PROJECT')) throw new GradleException('Missing observability upload configuration')
    if (sloganObservability.release != System.getenv('EXPO_PUBLIC_OBSERVABILITY_RELEASE') || sloganObservability.build != System.getenv('EXPO_PUBLIC_OBSERVABILITY_BUILD') || sloganObservability.dsn != System.getenv('EXPO_PUBLIC_SENTRY_DSN')) throw new GradleException('Observability prebuild and release configuration differ')
}
// End Slogan observability symbols\n`;
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const directory = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/java/com/slogan/mobile',
      );
      await fs.mkdir(directory, { recursive: true });
      const template = await fs.readFile(path.join(__dirname, 'SloganObservability.kt'), 'utf8');
      await fs.writeFile(path.join(directory, 'SloganObservability.kt'), template);
      const assets = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/assets');
      await fs.mkdir(assets, { recursive: true });
      await fs.writeFile(path.join(assets, 'slogan.observability.json'), JSON.stringify(safe));
      return mod;
    },
  ]);
};
