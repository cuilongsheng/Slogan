import type { FlatList } from 'react-native';
/** Preserve a visible entry, including simultaneous appends and variable-height call updates. */
export function captureChatAnchor(list: FlatList<unknown> | null): () => boolean {
  const node = list?.getScrollableNode() as HTMLElement | undefined;
  if (!node?.querySelectorAll) return () => true;
  const bounds = node.getBoundingClientRect();
  const entry = [...node.querySelectorAll<HTMLElement>('[data-testid^="chat-entry-"]')].find(
    (e) => {
      const rect = e.getBoundingClientRect();
      return rect.bottom > bounds.top && rect.top < bounds.bottom;
    },
  );
  if (!entry) return () => true;
  const top = entry.getBoundingClientRect().top;
  const id = entry.dataset.testid;
  const height = node.scrollHeight;
  const offset = node.scrollTop;
  let moved = false;
  return () => {
    const current = [...node.querySelectorAll<HTMLElement>('[data-testid^="chat-entry-"]')].find(
      (e) => e.dataset.testid === id,
    );
    if (!node.isConnected) return true;
    if (current) {
      node.scrollTop += current.getBoundingClientRect().top - top;
      return true;
    }
    // Virtualization can temporarily unmount the old entry after a prepend. Move the
    // window by the measured content growth, then correct against the entry once rendered.
    if (!moved) {
      moved = true;
      node.scrollTop = offset + node.scrollHeight - height;
    }
    return false;
  };
}
