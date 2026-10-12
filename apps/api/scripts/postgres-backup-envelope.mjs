import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdir, mkdtemp, open, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
const magic = Buffer.from('SLOGANPG1\n');
export function databaseIdentity(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname === '/')
    throw new Error('DATABASE_TARGET_INVALID');
  return `${url.hostname.toLowerCase()}:${url.port || '5432'}${decodeURIComponent(url.pathname)}`;
}
export function databaseFingerprint(value) {
  return createHash('sha256').update(databaseIdentity(value)).digest('hex');
}
/** Database tools need session continuity; Neon uses the same endpoint without -pooler. */
export function databaseToolConnection(value) {
  databaseIdentity(value);
  const url = new URL(value);
  if (/^ep-[a-z0-9-]+-pooler\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname)) {
    url.hostname = url.hostname.replace('-pooler.', '.');
    return url.toString();
  }
  return value;
}
function connectionEnvironment(value) {
  databaseIdentity(value);
  const url = new URL(databaseToolConnection(value));
  // libpq receives credentials through its environment, never process arguments.
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
    PGCONNECT_TIMEOUT: '15',
    PGAPPNAME: 'slogan-recovery',
  };
}
function encryptionKey() {
  const encoded = process.env.BACKUP_ENCRYPTION_KEY_BASE64;
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('BACKUP_KEY_INVALID');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded)
    throw new Error('BACKUP_KEY_INVALID');
  return key;
}
function policy() {
  const environmentId = process.env.BACKUP_ENVIRONMENT_ID,
    keyId = process.env.BACKUP_ENCRYPTION_KEY_ID;
  if (!environmentId || !keyId || environmentId.length > 128 || keyId.length > 128)
    throw new Error('BACKUP_POLICY_INCOMPLETE');
  const positive = (name) => {
    const value = Number(process.env[name]);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('BACKUP_POLICY_INCOMPLETE');
    return value;
  };
  return {
    environmentId,
    keyId,
    retentionCount: positive('BACKUP_RETENTION_COUNT'),
    rpoSeconds: positive('BACKUP_RPO_SECONDS'),
    rtoSeconds: positive('BACKUP_RTO_SECONDS'),
  };
}
function runPostgres(command, args, url, input = 'ignore') {
  const child = spawn(command, args, {
    env: connectionEnvironment(url),
    stdio: [input, 'pipe', 'pipe'],
    timeout: 600_000,
  });
  // Provider diagnostics can contain connection details or private rows.
  child.stderr.resume();
  const done = new Promise((accept, reject) => {
    child.once('error', () => reject(new Error('POSTGRES_TOOL_FAILED')));
    child.once('close', (code) =>
      code === 0 ? accept() : reject(new Error('POSTGRES_TOOL_FAILED')),
    );
  });
  void done.catch(() => {});
  return { child, done };
}
export async function digestFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function encryptedBackup(url, destination) {
  const configuration = policy(),
    key = encryptionKey(),
    output = resolve(destination),
    iv = randomBytes(12);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const temporary = `${output}.${randomBytes(12).toString('hex')}.partial`;
  const header = Buffer.from(
    JSON.stringify({
      version: 1,
      ...configuration,
      createdAt: new Date().toISOString(),
      iv: iv.toString('base64'),
      databaseFingerprint: databaseFingerprint(url),
    }),
  );
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  const prefix = Buffer.concat([magic, length, header]);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(prefix);
  let handle;
  try {
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(prefix);
    } finally {
      await file.close();
    }
    handle = runPostgres('pg_dump', ['--format=custom', '--no-owner', '--no-acl'], url);
    await pipeline(
      handle.child.stdout,
      cipher,
      createWriteStream(temporary, { flags: 'a', mode: 0o600 }),
    );
    await handle.done;
    const trailer = await open(temporary, 'a');
    try {
      await trailer.writeFile(cipher.getAuthTag());
      await trailer.sync();
    } finally {
      await trailer.close();
    }
    await rename(temporary, output);
    await chmod(output, 0o600);
    return {
      status: 'SUCCEEDED',
      environmentId: configuration.environmentId,
      encryptionKeyId: configuration.keyId,
      encrypted: true,
      digest: await digestFile(output),
    };
  } catch {
    handle?.child.kill();
    await rm(temporary, { force: true });
    throw new Error('BACKUP_FAILED');
  } finally {
    key.fill(0);
  }
}
/** Authenticate the complete archive before pg_restore can write to its target. */
export async function decryptBackup(input) {
  const configuration = policy(),
    key = encryptionKey(),
    directory = await mkdtemp(join(tmpdir(), 'slogan-restore-'));
  await chmod(directory, 0o700);
  const plaintext = join(directory, 'database.dump');
  let handle;
  try {
    handle = await open(input, 'r');
    const size = (await stat(input)).size,
      prefixHead = Buffer.alloc(magic.length + 4);
    if (
      (await handle.read(prefixHead, 0, prefixHead.length, 0)).bytesRead !== prefixHead.length ||
      !prefixHead.subarray(0, magic.length).equals(magic)
    )
      throw new Error('BACKUP_FORMAT_INVALID');
    const length = prefixHead.readUInt32BE(magic.length);
    if (length < 1 || length > 4096 || size <= prefixHead.length + length + 16)
      throw new Error('BACKUP_FORMAT_INVALID');
    const headerBytes = Buffer.alloc(length);
    if ((await handle.read(headerBytes, 0, length, prefixHead.length)).bytesRead !== length)
      throw new Error('BACKUP_FORMAT_INVALID');
    const header = JSON.parse(headerBytes.toString('utf8'));
    if (
      header.version !== 1 ||
      header.environmentId !== configuration.environmentId ||
      header.keyId !== configuration.keyId
    )
      throw new Error('BACKUP_POLICY_MISMATCH');
    const iv = Buffer.from(header.iv, 'base64');
    if (iv.length !== 12) throw new Error('BACKUP_FORMAT_INVALID');
    const tag = Buffer.alloc(16);
    await handle.read(tag, 0, 16, size - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.concat([prefixHead, headerBytes]));
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(input, { start: prefixHead.length + length, end: size - 17 }),
      decipher,
      createWriteStream(plaintext, { flags: 'wx', mode: 0o600 }),
    );
    return { plaintext, header, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch {
    await rm(directory, { recursive: true, force: true });
    throw new Error('BACKUP_AUTHENTICATION_FAILED');
  } finally {
    await handle?.close();
    key.fill(0);
  }
}
export async function isolatedRestore(url, input) {
  if (process.env.RESTORE_ISOLATED !== 'true' || process.env.PROVIDERS_DISABLED !== 'true')
    throw new Error('RESTORE_ISOLATION_REQUIRED');
  if (process.env.RESTORE_TARGET_FINGERPRINT !== databaseFingerprint(url))
    throw new Error('RESTORE_TARGET_NOT_APPROVED');
  if (!/(restore|isolated|recovery)/i.test(new URL(url).pathname))
    throw new Error('RESTORE_TARGET_NAME_UNSAFE');
  if (
    process.env.DATABASE_URL &&
    databaseIdentity(process.env.DATABASE_URL) === databaseIdentity(url)
  )
    throw new Error('RESTORE_ACTIVE_DATABASE_FORBIDDEN');
  const decoded = await decryptBackup(input);
  let handle;
  try {
    if (decoded.header.databaseFingerprint === databaseFingerprint(url))
      throw new Error('RESTORE_SOURCE_TARGET_IDENTICAL');
    handle = runPostgres(
      'pg_restore',
      [
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        '--single-transaction',
        '--exit-on-error',
        '--dbname',
        connectionEnvironment(url).PGDATABASE,
      ],
      url,
      'pipe',
    );
    handle.child.stdout.resume();
    await pipeline(createReadStream(decoded.plaintext), handle.child.stdin);
    await handle.done;
    return { status: 'SUCCEEDED', environmentId: decoded.header.environmentId };
  } catch {
    handle?.child.kill();
    throw new Error('RESTORE_FAILED');
  } finally {
    await decoded.cleanup();
  }
}
