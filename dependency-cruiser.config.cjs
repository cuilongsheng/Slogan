const adminFeatures = ['auth', 'dashboard', 'rooms', 'moderation', 'users', 'settings'];
const mobileFeatures = ['auth', 'profile', 'room-discovery', 'voice-room', 'reporting'];
const apiModules = ['auth', 'users', 'profiles', 'rooms', 'voice', 'moderation', 'audit'];

const protectInternals = (root, names, internalPattern) =>
  names.map((name) => ({
    name: `no-deep-import-${root.replaceAll('/', '-')}-${name}`,
    severity: 'error',
    from: {
      pathNot: `^${root}/${name}/`,
    },
    to: {
      path: `^${root}/${name}/${internalPattern}/`,
    },
  }));

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-admin-to-other-apps',
      severity: 'error',
      from: { path: '^apps/admin/' },
      to: { path: '^apps/(mobile|api)/' },
    },
    {
      name: 'no-mobile-to-other-apps',
      severity: 'error',
      from: { path: '^apps/mobile/' },
      to: { path: '^apps/(admin|api)/' },
    },
    {
      name: 'no-api-to-frontends',
      severity: 'error',
      from: { path: '^apps/api/' },
      to: { path: '^apps/(admin|mobile)/' },
    },
    {
      name: 'no-package-to-app',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'shared-has-no-platform-frameworks',
      severity: 'error',
      from: { path: '^packages/shared/' },
      to: {
        path: '^(react|react-native|@nestjs|@prisma|livekit|expo)(/|$)',
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
      },
    },
    {
      name: 'shared-has-no-node-core',
      severity: 'error',
      from: { path: '^packages/shared/' },
      to: { dependencyTypes: ['core'] },
    },
    ...protectInternals('apps/admin/src/features', adminFeatures, '(api|components|hooks|model)'),
    ...protectInternals('apps/mobile/src/features', mobileFeatures, '(api|components|hooks|model)'),
    ...protectInternals(
      'apps/api/src/modules',
      apiModules,
      '(presentation|application|domain|infrastructure)',
    ),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: ['(^|/)dist/', '(^|/)coverage/', '(^|/)generated/'],
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
  },
};
