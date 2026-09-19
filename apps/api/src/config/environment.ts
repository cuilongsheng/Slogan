import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const booleanFromEnvironment = z.preprocess((value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false' || value === undefined) return false;
  return value;
}, z.boolean());

const commaSeparatedUrls = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1));

const environmentSchema = z
  .object({
    APP_NAME: z.string().trim().min(1),
    APP_PORT: z.coerce.number().int().positive().max(65_535).default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().startsWith('postgresql://'),
    CORS_ALLOWED_ORIGINS: commaSeparatedUrls,
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    JWT_ISSUER: z.string().trim().min(1).default('slogan-api'),
    JWT_AUDIENCE: z.string().trim().min(1).default('slogan-clients'),
    REFRESH_TOKEN_PEPPER: z.string().min(32),
    ROOM_PASSWORD_PEPPER: z.string().min(32),
    ROOM_RULES_VERSION: z.string().trim().min(1).max(64),
    ROOM_SHARE_BASE_URL: z.url(),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3600)
      .max(60 * 60 * 24 * 90)
      .default(60 * 60 * 24 * 30),
    AUTH_RATE_LIMIT_POINTS: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_RATE_LIMIT_DURATION_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
    OAUTH_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5000),
    PHONE_AUTH_ENABLED: booleanFromEnvironment,
    ACCOUNT_LIFECYCLE_ENABLED: booleanFromEnvironment,
    PHONE_IDENTITY_HASH_VERSION: z.string().trim().min(1).max(32).default('v1'),
    PHONE_IDENTITY_PEPPER: optionalString,
    PHONE_OTP_CODE_PEPPER: optionalString,
    PHONE_OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
    PHONE_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    PHONE_OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(10).max(600).default(60),
    PHONE_OTP_RATE_LIMIT_POINTS: z.coerce.number().int().min(1).max(100).default(5),
    PHONE_OTP_RATE_LIMIT_DURATION_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(3600),
    PHONE_OTP_GLOBAL_RATE_LIMIT_POINTS: z.coerce.number().int().min(1).max(1_000_000).default(1000),
    PHONE_VERIFICATION_GRANT_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
    SMS_PROVIDER_CATEGORY: optionalString,
    SMS_PROVIDER_BASE_URL: optionalString,
    SMS_PROVIDER_API_KEY: optionalString,
    SMS_PROVIDER_SENDER: optionalString,
    SMS_PROVIDER_TEMPLATE: optionalString,
    SMS_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5000),
    SMS_SUPPORTED_REGIONS: optionalString,
    ACCOUNT_COMMAND_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    REALTIME_ENABLED: booleanFromEnvironment,
    LIVEKIT_URL: optionalString,
    LIVEKIT_API_KEY: optionalString,
    LIVEKIT_API_SECRET: optionalString,
    LIVEKIT_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(300),
    REDIS_URL: optionalString,
    SOCIAL_PRESENCE_TTL_SECONDS: z.coerce.number().int().min(30).max(300).default(90),
    ASSISTANCE_ENABLED: booleanFromEnvironment,
    ASSISTANCE_AUDIO_ENABLED: booleanFromEnvironment,
    ASSISTANCE_NOTICE_VERSION: z.string().trim().min(1).max(64).default('2026-09-v1'),
    ASSISTANCE_OUTPUT_TTL_SECONDS: z.coerce.number().int().min(300).max(604_800).default(86_400),
    ASSISTANCE_LEASE_SECONDS: z.coerce.number().int().min(5).max(300).default(30),
    ASSISTANCE_RATE_LIMIT_POINTS: z.coerce.number().int().min(1).max(1000).default(10),
    ASSISTANCE_RATE_LIMIT_DURATION_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
    ASSISTANCE_MAX_CONCURRENT: z.coerce.number().int().min(1).max(20).default(2),
    ASSISTANCE_USER_DAILY_REQUESTS: z.coerce.number().int().min(1).max(10_000).default(100),
    ASSISTANCE_USER_DAILY_AUDIO_SECONDS: z.coerce.number().int().min(1).max(86_400).default(600),
    ASSISTANCE_PLATFORM_DAILY_UNITS: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000_000)
      .default(100_000),
    AI_EXPRESSION_PROVIDER_CATEGORY: optionalString,
    AI_EXPRESSION_BASE_URL: optionalString,
    AI_EXPRESSION_API_KEY: optionalString,
    AI_EXPRESSION_MODEL: optionalString,
    AI_EXPRESSION_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(10_000),
    AI_EXPRESSION_REGION: optionalString,
    AI_EXPRESSION_DATA_USE: z.enum(['REQUEST_PROCESSING_ONLY']).optional(),
    AI_EXPRESSION_RETENTION_SECONDS: z.coerce.number().int().min(0).max(604_800).optional(),
    AI_EXPRESSION_NO_TRAINING: booleanFromEnvironment,
    STT_PROVIDER_CATEGORY: optionalString,
    STT_BASE_URL: optionalString,
    STT_API_KEY: optionalString,
    STT_MODEL: optionalString,
    STT_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(15_000),
    STT_REGION: optionalString,
    STT_DATA_USE: z.enum(['REQUEST_PROCESSING_ONLY']).optional(),
    STT_RETENTION_SECONDS: z.coerce.number().int().min(0).max(604_800).optional(),
    STT_DELETION_MODE: z.enum(['NO_RETENTION', 'DELETE_AFTER_PROCESSING']).optional(),
    STT_STREAMING_MODE: z.enum(['SHORT_WINDOW']).optional(),
    ROOM_SPEECH_DETECTION_ENABLED: booleanFromEnvironment,
    ROOM_SPEECH_NOTICE_VERSION: z.string().trim().min(1).max(64).default('2026-09-v1'),
    ROOM_SPEECH_RULE_SET_VERSION: z.string().trim().min(1).max(64).default('2026-09-v1'),
    ROOM_SPEECH_HASH_SECRET: optionalString,
    ROOM_SPEECH_LEASE_SECONDS: z.coerce.number().int().min(5).max(120).default(30),
    ROOM_SPEECH_WINDOW_MS: z.coerce.number().int().min(250).max(15_000).default(3000),
    ROOM_SPEECH_MAX_BUFFER_BYTES: z.coerce
      .number()
      .int()
      .min(16_000)
      .max(10_000_000)
      .default(512_000),
    ROOM_SPEECH_MAX_ROOM_BUFFER_BYTES: z.coerce
      .number()
      .int()
      .min(16_000)
      .max(50_000_000)
      .default(2_048_000),
    ROOM_SPEECH_SILENCE_MS: z.coerce.number().int().min(100).max(10_000).default(1500),
    ROOM_SPEECH_ALERT_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
    ROOM_SPEECH_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(90),
    POST_ROOM_KEYWORDS_ENABLED: booleanFromEnvironment,
    POST_ROOM_KEYWORDS_NOTICE_VERSION: z.string().trim().min(1).max(64).default('2026-09-v1'),
    POST_ROOM_KEYWORDS_EXTRACTOR_VERSION: z.string().trim().min(1).max(64).default('2026-09-v1'),
    POST_ROOM_KEYWORDS_MAX_KEYWORDS: z.coerce.number().int().min(1).max(100).default(20),
    POST_ROOM_KEYWORDS_MAX_EXPRESSIONS: z.coerce.number().int().min(1).max(50).default(10),
    POST_ROOM_KEYWORDS_CANDIDATE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(86_400)
      .default(14_400),
    POST_ROOM_KEYWORDS_JOB_LEASE_SECONDS: z.coerce.number().int().min(5).max(300).default(30),
    POST_ROOM_KEYWORDS_JOB_DEADLINE_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(600),
    POST_ROOM_KEYWORDS_COMMAND_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    OPERATIONS_GOVERNANCE_ENABLED: booleanFromEnvironment,
    OPERATIONS_METRIC_DEFINITION_VERSION: z.string().trim().min(1).max(64).default('2026-09-v1'),
    OPERATIONS_METRIC_MIN_SAMPLE: z.coerce.number().int().min(10).max(10_000).default(10),
    OPERATIONS_METRIC_FRESHNESS_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(604_800)
      .default(172_800),
    OPERATIONS_METRIC_LEASE_SECONDS: z.coerce.number().int().min(5).max(900).default(60),
    OPERATIONS_INCIDENT_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(100).default(3),
    OPERATIONS_INCIDENT_COOLDOWN_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(86_400)
      .default(300),
    OPERATIONS_ALERT_SINK_URL: optionalString,
    OPERATIONS_ALERT_SINK_TOKEN: optionalString,
    OPERATIONS_ALERT_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5000),
    GOVERNANCE_RETENTION_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
    GOVERNANCE_DRY_RUN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3600),
    GOVERNANCE_LEASE_SECONDS: z.coerce.number().int().min(5).max(900).default(60),
    GOVERNANCE_TECHNICAL_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    BACKUP_ENVIRONMENT_ID: optionalString,
    BACKUP_ENCRYPTION_KEY_ID: optionalString,
    BACKUP_RETENTION_COUNT: z.coerce.number().int().min(1).max(365).optional(),
    BACKUP_RPO_SECONDS: z.coerce.number().int().min(60).max(2_592_000).optional(),
    BACKUP_RTO_SECONDS: z.coerce.number().int().min(60).max(604_800).optional(),
    GOOGLE_OAUTH_ENABLED: booleanFromEnvironment,
    GOOGLE_OAUTH_CLIENT_ID: optionalString,
    GOOGLE_OAUTH_CLIENT_SECRET: optionalString,
    GOOGLE_OAUTH_REDIRECT_URIS: optionalString,
    WECHAT_OAUTH_ENABLED: booleanFromEnvironment,
    WECHAT_OAUTH_CLIENT_ID: optionalString,
    WECHAT_OAUTH_CLIENT_SECRET: optionalString,
    WECHAT_OAUTH_REDIRECT_URIS: optionalString,
  })
  .superRefine((environment, context) => {
    try {
      const shareUrl = new URL(environment.ROOM_SHARE_BASE_URL);
      const localTestUrl =
        environment.NODE_ENV === 'test' &&
        shareUrl.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(shareUrl.hostname);
      if (
        (shareUrl.protocol !== 'https:' && !localTestUrl) ||
        shareUrl.username ||
        shareUrl.password ||
        shareUrl.search ||
        shareUrl.hash
      ) {
        context.addIssue({ code: 'custom', message: 'Room share base URL is invalid' });
      }
    } catch {
      context.addIssue({ code: 'custom', message: 'Room share base URL is invalid' });
    }
    if (environment.REALTIME_ENABLED) {
      const cloudUrl = environment.LIVEKIT_URL;
      let validCloud = false;
      let validRedis = false;
      try {
        const url = new URL(cloudUrl ?? '');
        validCloud =
          url.protocol === 'wss:' &&
          url.hostname.endsWith('.livekit.cloud') &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === '/';
      } catch {
        /* Invalid configuration is reported without revealing its value. */
      }
      try {
        const url = new URL(environment.REDIS_URL ?? '');
        validRedis = ['redis:', 'rediss:'].includes(url.protocol) && !!url.hostname;
      } catch {
        /* See above. */
      }
      if (
        !validCloud ||
        !validRedis ||
        !environment.LIVEKIT_API_KEY ||
        !environment.LIVEKIT_API_SECRET ||
        environment.LIVEKIT_API_SECRET.length < 32
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Realtime requires a LiveKit Cloud WSS URL, key, secret (32+ characters), and Redis URL',
        });
      }
    }
    if (environment.PHONE_AUTH_ENABLED) {
      const required = [
        environment.REDIS_URL,
        environment.PHONE_IDENTITY_PEPPER,
        environment.PHONE_OTP_CODE_PEPPER,
        environment.SMS_PROVIDER_CATEGORY,
        environment.SMS_PROVIDER_BASE_URL,
        environment.SMS_PROVIDER_API_KEY,
        environment.SMS_PROVIDER_SENDER,
        environment.SMS_PROVIDER_TEMPLATE,
        environment.SMS_SUPPORTED_REGIONS,
      ];
      if (
        required.some((value) => value === undefined) ||
        (environment.PHONE_IDENTITY_PEPPER?.length ?? 0) < 32 ||
        (environment.PHONE_OTP_CODE_PEPPER?.length ?? 0) < 32 ||
        !validProviderUrl(environment.SMS_PROVIDER_BASE_URL, environment.NODE_ENV) ||
        !validRedisUrl(environment.REDIS_URL) ||
        !environment.SMS_SUPPORTED_REGIONS?.split(',').some((item) => item.trim().length === 2)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Phone authentication requires secure SMS policy, secrets, regions, and Redis',
        });
      }
    }
    if (environment.ACCOUNT_LIFECYCLE_ENABLED && !validRedisUrl(environment.REDIS_URL)) {
      context.addIssue({
        code: 'custom',
        message: 'Account lifecycle requires Redis for short-lived step-up proofs',
      });
    }
    if (environment.ASSISTANCE_AUDIO_ENABLED && !environment.ASSISTANCE_ENABLED) {
      context.addIssue({ code: 'custom', message: 'Assistance audio requires assistance' });
    }
    if (environment.ASSISTANCE_ENABLED) {
      const required = [
        environment.REDIS_URL,
        environment.AI_EXPRESSION_PROVIDER_CATEGORY,
        environment.AI_EXPRESSION_BASE_URL,
        environment.AI_EXPRESSION_API_KEY,
        environment.AI_EXPRESSION_MODEL,
        environment.AI_EXPRESSION_REGION,
        environment.AI_EXPRESSION_DATA_USE,
      ];
      if (
        required.some((value) => value === undefined) ||
        environment.AI_EXPRESSION_RETENTION_SECONDS === undefined ||
        !environment.AI_EXPRESSION_NO_TRAINING ||
        !validProviderUrl(environment.AI_EXPRESSION_BASE_URL, environment.NODE_ENV) ||
        !validRedisUrl(environment.REDIS_URL)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Enabled assistance requires secure AI policy, credentials, and Redis',
        });
      }
    }
    if (environment.ASSISTANCE_AUDIO_ENABLED) {
      const required = [
        environment.STT_PROVIDER_CATEGORY,
        environment.STT_BASE_URL,
        environment.STT_API_KEY,
        environment.STT_MODEL,
        environment.STT_REGION,
        environment.STT_DATA_USE,
        environment.STT_DELETION_MODE,
      ];
      if (
        required.some((value) => value === undefined) ||
        environment.STT_RETENTION_SECONDS === undefined ||
        !validProviderUrl(environment.STT_BASE_URL, environment.NODE_ENV)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Enabled assistance audio requires secure STT policy and credentials',
        });
      }
    }
    if (environment.ROOM_SPEECH_DETECTION_ENABLED) {
      const required = [
        environment.REDIS_URL,
        environment.LIVEKIT_URL,
        environment.LIVEKIT_API_KEY,
        environment.LIVEKIT_API_SECRET,
        environment.STT_PROVIDER_CATEGORY,
        environment.STT_BASE_URL,
        environment.STT_API_KEY,
        environment.STT_MODEL,
        environment.STT_REGION,
        environment.STT_DATA_USE,
        environment.STT_DELETION_MODE,
        environment.ROOM_SPEECH_HASH_SECRET,
        environment.STT_STREAMING_MODE,
      ];
      if (
        !environment.REALTIME_ENABLED ||
        required.some((value) => value === undefined) ||
        (environment.ROOM_SPEECH_HASH_SECRET?.length ?? 0) < 32 ||
        environment.STT_RETENTION_SECONDS === undefined ||
        !validProviderUrl(environment.STT_BASE_URL, environment.NODE_ENV) ||
        !validRedisUrl(environment.REDIS_URL)
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Room speech detection requires realtime, secure STT policy, hash secret, and Redis',
        });
      }
    }
    if (environment.POST_ROOM_KEYWORDS_ENABLED) {
      const required = [
        environment.REDIS_URL,
        environment.LIVEKIT_URL,
        environment.LIVEKIT_API_KEY,
        environment.LIVEKIT_API_SECRET,
        environment.STT_PROVIDER_CATEGORY,
        environment.STT_BASE_URL,
        environment.STT_API_KEY,
        environment.STT_MODEL,
        environment.STT_REGION,
        environment.STT_DATA_USE,
        environment.STT_DELETION_MODE,
        environment.STT_STREAMING_MODE,
      ];
      if (
        !environment.REALTIME_ENABLED ||
        required.some((value) => value === undefined) ||
        environment.STT_RETENTION_SECONDS === undefined ||
        !validProviderUrl(environment.STT_BASE_URL, environment.NODE_ENV) ||
        !validRedisUrl(environment.REDIS_URL)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Post-room keywords require realtime, secure streaming STT policy, and Redis',
        });
      }
    }
    const alertSinkConfigured = environment.OPERATIONS_ALERT_SINK_URL !== undefined;
    if (
      alertSinkConfigured &&
      (!validProviderUrl(environment.OPERATIONS_ALERT_SINK_URL, environment.NODE_ENV) ||
        (environment.OPERATIONS_ALERT_SINK_TOKEN?.length ?? 0) < 32)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Operations alert sink requires a secure URL and token',
      });
    }
    if (!alertSinkConfigured && environment.OPERATIONS_ALERT_SINK_TOKEN !== undefined) {
      context.addIssue({ code: 'custom', message: 'Operations alert sink URL is required' });
    }
    const backupValues = [
      environment.BACKUP_ENVIRONMENT_ID,
      environment.BACKUP_ENCRYPTION_KEY_ID,
      environment.BACKUP_RETENTION_COUNT,
      environment.BACKUP_RPO_SECONDS,
      environment.BACKUP_RTO_SECONDS,
    ];
    if (
      backupValues.some((value) => value !== undefined) &&
      backupValues.some((value) => value === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Backup readiness requires environment, encryption, retention, RPO, and RTO policy',
      });
    }
    const providers = [
      {
        enabled: environment.GOOGLE_OAUTH_ENABLED,
        name: 'GOOGLE_OAUTH',
        values: [
          environment.GOOGLE_OAUTH_CLIENT_ID,
          environment.GOOGLE_OAUTH_CLIENT_SECRET,
          environment.GOOGLE_OAUTH_REDIRECT_URIS,
        ],
      },
      {
        enabled: environment.WECHAT_OAUTH_ENABLED,
        name: 'WECHAT_OAUTH',
        values: [
          environment.WECHAT_OAUTH_CLIENT_ID,
          environment.WECHAT_OAUTH_CLIENT_SECRET,
          environment.WECHAT_OAUTH_REDIRECT_URIS,
        ],
      },
    ];

    for (const provider of providers) {
      if (provider.enabled && provider.values.some((value) => value === undefined)) {
        context.addIssue({
          code: 'custom',
          message: `${provider.name} credentials and redirect URIs are required when enabled`,
        });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

function validProviderUrl(value: string | undefined, nodeEnvironment: string): boolean {
  try {
    const url = new URL(value ?? '');
    const localTest =
      nodeEnvironment === 'test' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname);
    return (
      (url.protocol === 'https:' || localTest) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function validRedisUrl(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? '');
    return ['redis:', 'rediss:'].includes(url.protocol) && !!url.hostname;
  } catch {
    return false;
  }
}

export function validateEnvironment(input: Record<string, unknown>): Environment {
  return environmentSchema.parse(input);
}
