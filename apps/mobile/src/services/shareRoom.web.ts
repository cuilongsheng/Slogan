export async function copyRoomUrl(url: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
  await navigator.clipboard.writeText(url);
}

export async function shareRoomUrl(url: string): Promise<'copied'> {
  await copyRoomUrl(url);
  return 'copied';
}
