import { SMTPServer } from 'smtp-server';
import type { AddressInfo } from 'node:net';
export async function smtpFixture() {
  const messages: string[] = [];
  let mode: 'accept' | 'reject' | 'timeout' = 'accept';
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    logger: false,
    socketTimeout: 1000,
    onData(stream, _session, callback) {
      let body = '';
      stream.on('data', (chunk) => {
        body += String(chunk);
      });
      stream.on('end', () => {
        messages.push(body);
        if (mode === 'reject')
          callback(Object.assign(new Error('fixture rejection'), { responseCode: 550 }));
        else if (mode === 'accept') callback();
      });
    },
  });
  server.on('error', () => undefined);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.server.address() as AddressInfo).port;
  return {
    port,
    messages,
    setMode(value: typeof mode) {
      mode = value;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
