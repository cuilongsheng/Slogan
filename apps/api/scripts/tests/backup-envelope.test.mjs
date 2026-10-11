import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  databaseFingerprint,
  decryptBackup,
  encryptedBackup,
  isolatedRestore,
} from '../postgres-backup-envelope.mjs';
test('encrypted archives authenticate before any database mutation and enforce isolated targets', async () => {
  const saved = { ...process.env },
    directory = await mkdtemp(join(tmpdir(), 'slogan-envelope-test-'));
  const source = 'postgresql://test:test@localhost:5432/source',
    target = 'postgresql://test:test@localhost:5432/isolated_restore';
  const output = join(directory, 'backup.pgenc'),
    marker = join(directory, 'restore-marker');
  try {
    const dump = join(directory, 'pg_dump'),
      restore = join(directory, 'pg_restore');
    await writeFile(dump, "#!/bin/sh\nprintf 'PGDMPprivate-fixture-content'\n");
    await chmod(dump, 0o700);
    await writeFile(restore, '#!/bin/sh\ncat > "$RESTORE_TEST_MARKER"\n');
    await chmod(restore, 0o700);
    Object.assign(process.env, {
      PATH: `${directory}:${saved.PATH}`,
      BACKUP_ENVIRONMENT_ID: 'test',
      BACKUP_ENCRYPTION_KEY_ID: 'test-key',
      BACKUP_ENCRYPTION_KEY_BASE64: randomBytes(32).toString('base64'),
      BACKUP_RETENTION_COUNT: '14',
      BACKUP_RPO_SECONDS: '86400',
      BACKUP_RTO_SECONDS: '3600',
      DATABASE_URL: source,
      RESTORE_ISOLATED: 'true',
      PROVIDERS_DISABLED: 'true',
      RESTORE_TARGET_FINGERPRINT: databaseFingerprint(target),
      RESTORE_TEST_MARKER: marker,
    });
    const receipt = await encryptedBackup(source, output);
    assert.equal(receipt.encrypted, true);
    const bytes = await readFile(output);
    assert.equal(bytes.includes(Buffer.from('private-fixture-content')), false);
    const decoded = await decryptBackup(output);
    try {
      assert.equal((await readFile(decoded.plaintext)).toString(), 'PGDMPprivate-fixture-content');
    } finally {
      await decoded.cleanup();
    }
    const corrupt = Buffer.from(bytes);
    corrupt[corrupt.length - 20] ^= 1;
    const tampered = join(directory, 'tampered.pgenc');
    await writeFile(tampered, corrupt);
    await assert.rejects(isolatedRestore(target, tampered), /AUTHENTICATION/);
    await assert.rejects(readFile(marker), { code: 'ENOENT' });
    const actualKey = process.env.BACKUP_ENCRYPTION_KEY_BASE64;
    process.env.BACKUP_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString('base64');
    await assert.rejects(isolatedRestore(target, output), /AUTHENTICATION/);
    process.env.BACKUP_ENCRYPTION_KEY_BASE64 = actualKey;
    await assert.rejects(isolatedRestore(source, output), /NOT_APPROVED/);
    await isolatedRestore(target, output);
    assert.equal((await readFile(marker)).toString(), 'PGDMPprivate-fixture-content');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    await rm(directory, { recursive: true, force: true });
  }
});
