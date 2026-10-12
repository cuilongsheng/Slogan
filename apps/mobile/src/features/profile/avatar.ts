import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { createMobileApiClient } from '../../api/client';
import type { AuthorizedRequest } from '../room-discovery';
export function defaultAvatarUrl(): string {
  return new URL(
    '/v1/avatars/default',
    process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000',
  ).toString();
}
export async function selectAvatar(authorized: AuthorizedRequest): Promise<string | null> {
  const selected = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  });
  const asset = selected.assets?.[0];
  if (selected.canceled || !asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  const edge = Math.min(asset.width, asset.height);
  context
    .crop({
      originX: (asset.width - edge) / 2,
      originY: (asset.height - edge) / 2,
      width: edge,
      height: edge,
    })
    .resize({ width: 256, height: 256 });
  const image = await context.renderAsync();
  const png = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
  if (!png.base64 || png.base64.length > 349528) throw new Error('AVATAR_INVALID');
  const client = createMobileApiClient();
  const result = await authorized((token) =>
    client.POST('/v1/me/avatar', {
      headers: { Authorization: `Bearer ${token}` },
      body: { imageBase64: png.base64! },
    }),
  );
  if (!result.data) throw new Error('AVATAR_UPLOAD_FAILED');
  return result.data.avatarUrl;
}
