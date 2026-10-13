import * as Clipboard from 'expo-clipboard';

export async function copyRoomUrl(url: string): Promise<void> {
  if (!(await Clipboard.setStringAsync(url))) throw new Error('CLIPBOARD_UNAVAILABLE');
}

export async function shareRoomUrl(url: string): Promise<'copied'> {
  await copyRoomUrl(url);
  return 'copied';
}
