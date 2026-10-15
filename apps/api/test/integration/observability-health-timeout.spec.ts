import { connect, createServer, type Socket } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { HealthService } from '../../src/modules/health/health.service.js';
import { testEnvironment } from '../fixtures/environment.js';

it.each(['connection', 'query'])('actual pg health pool bounds a stalled %s', async (stage) => {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
    if (stage === 'connection') return;
    const upstream = connect(54329, '127.0.0.1');
    sockets.add(upstream);
    upstream.on('error', () => socket.destroy());
    upstream.on('data', (data) => socket.write(data));
    socket.on('data', (data) => {
      if (!data.toString().includes('SELECT 1')) upstream.write(data);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected local TCP port');
  const health = new HealthService(
    new ConfigService(
      testEnvironment({
        DATABASE_URL: `postgresql://slogan:slogan@127.0.0.1:${address.port}/slogan_test`,
      }),
    ),
  );
  try {
    const started = Date.now();
    expect(await health.ready()).toBe(false);
    expect(Date.now() - started).toBeLessThan(3500);
  } finally {
    for (const socket of sockets) socket.destroy();
    await health.onModuleDestroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
