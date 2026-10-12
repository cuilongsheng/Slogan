import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import { commandDiagnostic, recognizedCommandError } from '../release/command-diagnostic.mjs';

test('installation, migration and provider errors expose codes without private output', () => {
  assert.equal(recognizedCommandError('Error: ERR_PNPM_IGNORED_BUILDS'), 'ERR_PNPM_IGNORED_BUILDS');
  assert.equal(recognizedCommandError('Error: P1001 at postgresql://private'), 'P1001');
  assert.equal(
    recognizedCommandError('The provided token is not valid: private-token'),
    'VERCEL_AUTHENTICATION_FAILED',
  );
  assert.equal(recognizedCommandError('Forbidden: private-project'), 'VERCEL_PERMISSION_DENIED');
  assert.equal(
    recognizedCommandError('Project not found: private-project'),
    'VERCEL_PROJECT_NOT_FOUND',
  );
  assert.equal(
    recognizedCommandError('Bearer private-token; confidential output'),
    'COMMAND_FAILED',
  );
});

test('split chunks preserve a diagnostic while bounded output drops old private content', () => {
  const child = { stdout: new PassThrough(), stderr: new PassThrough() };
  const diagnostic = commandDiagnostic(child);
  child.stdout.write('private-output'.repeat(2000));
  child.stderr.write('Error: ERR_PNPM_');
  child.stderr.write('IGNORED_BUILDS');
  assert.equal(diagnostic(), 'ERR_PNPM_IGNORED_BUILDS');
  child.stdout.write('x'.repeat(16_384));
  assert.equal(diagnostic(), 'COMMAND_FAILED');
  child.stdout.end();
  child.stderr.end();
});
