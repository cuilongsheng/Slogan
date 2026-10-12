/** Retain bounded command output privately; publish only recognized error codes. */
export function commandDiagnostic(child) {
  let output = '';
  const capture = (chunk) => {
    output = (output + chunk.toString()).slice(-16_384);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  return () => recognizedCommandError(output);
}

export function recognizedCommandError(output) {
  const pnpm = output.match(/\bERR_PNPM_[A-Z_]+\b/);
  if (pnpm) return pnpm[0];
  const prisma = output.match(/\bP\d{4}\b/);
  if (prisma) return prisma[0];
  if (/provided token is not valid|invalid token|no credentials found/i.test(output))
    return 'VERCEL_AUTHENTICATION_FAILED';
  if (/forbidden|not authorized|insufficient permissions/i.test(output))
    return 'VERCEL_PERMISSION_DENIED';
  if (/project not found|could not find.*project/i.test(output)) return 'VERCEL_PROJECT_NOT_FOUND';
  return 'COMMAND_FAILED';
}
