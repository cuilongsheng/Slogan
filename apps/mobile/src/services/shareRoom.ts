import { Platform, Share } from 'react-native';

export async function shareRoomUrl(url: string): Promise<'copied' | 'shared' | 'cancelled'> {
  if (Platform.OS === 'web') {
    if (!globalThis.navigator?.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
    await globalThis.navigator.clipboard.writeText(url);
    return 'copied';
  }
  const result = await Share.share({ message: url, url });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
