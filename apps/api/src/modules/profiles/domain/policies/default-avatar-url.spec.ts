import { defaultAvatarVariant } from './default-avatar-url.js';

test('selects only the declared feminine default without modifying uploaded/provider images', () => {
  const url = 'https://mobile.example/v1/avatars/default';
  expect(defaultAvatarVariant(url, 'female')).toBe(`${url}?variant=female`);
  expect(defaultAvatarVariant(url, null)).toBe(`${url}?variant=male`);
  const custom = 'https://images.example/custom.png';
  expect(defaultAvatarVariant(custom, 'female')).toBe(custom);
  expect(defaultAvatarVariant(null, 'female')).toBeNull();
});
