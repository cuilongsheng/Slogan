import { PNG } from 'pngjs';
import { normalizeAvatar } from './avatar-image.js';
describe('bounded profile images', () => {
  it('strips metadata by retaining only bounded decoded PNG pixels', () => {
    const image = new PNG({ width: 8, height: 8 });
    image.data.fill(255);
    const output = normalizeAvatar(PNG.sync.write(image).toString('base64'));
    expect(PNG.sync.read(output).width).toBe(8);
    expect(PNG.sync.read(output).height).toBe(8);
  });
  it('rejects malformed bytes, oversized dimensions, and unsupported formats', () => {
    for (const input of ['', Buffer.from('not an image').toString('base64'), 'a'.repeat(349532)])
      expect(() => normalizeAvatar(input)).toThrow();
    const image = new PNG({ width: 513, height: 1 });
    expect(() => normalizeAvatar(PNG.sync.write(image).toString('base64'))).toThrow();
  });
});
