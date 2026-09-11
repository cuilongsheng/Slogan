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
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3600)
      .max(60 * 60 * 24 * 90)
      .default(60 * 60 * 24 * 30),
    AUTH_RATE_LIMIT_POINTS: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_RATE_LIMIT_DURATION_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
    OAUTH_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5000),
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

export function validateEnvironment(input: Record<string, unknown>): Environment {
  return environmentSchema.parse(input);
}
