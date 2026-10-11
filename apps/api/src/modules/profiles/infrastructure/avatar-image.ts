import { Injectable } from '@nestjs/common';
import type { AvatarImage } from '../domain/ports/avatar.repository.js';
import { defaultAvatar } from './default-avatar.js';
import { PNG } from 'pngjs';
import { AppError } from '../../../common/errors/app-error.js';

/** Decode bounded PNG pixels and re-encode them without ancillary metadata. */
export function normalizeAvatar(base64: string): Buffer {
  const invalid = () =>
    new AppError('AVATAR_INVALID', 'Choose a PNG image up to 256 KB and 512 × 512 pixels', 400);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0 || base64.length > 349528)
    throw invalid();
  const input = Buffer.from(base64, 'base64');
  if (
    input.length > 262144 ||
    input.length < 33 ||
    input.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    input.toString('ascii', 12, 16) !== 'IHDR'
  )
    throw invalid();
  const width = input.readUInt32BE(16),
    height = input.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 512 || height > 512) throw invalid();
  try {
    const decoded = PNG.sync.read(input, { checkCRC: true });
    const clean = new PNG({ width: decoded.width, height: decoded.height });
    clean.data = decoded.data;
    const output = PNG.sync.write(clean, { colorType: 6, bitDepth: 8 });
    if (output.length > 262144) throw invalid();
    return output;
  } catch {
    throw invalid();
  }
}

@Injectable()
export class PngAvatarImage implements AvatarImage {
  normalize(base64: string) {
    return normalizeAvatar(base64);
  }
  defaultImage() {
    return defaultAvatar;
  }
}
