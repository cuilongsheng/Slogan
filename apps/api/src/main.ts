import { ConfigService } from '@nestjs/config';

import { createApiApp } from './bootstrap/create-api-app.js';
import type { Environment } from './config/environment.js';

async function bootstrap() {
  const app = await createApiApp();
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  await app.listen(config.get('APP_PORT', { infer: true }), '127.0.0.1');
}

void bootstrap();
