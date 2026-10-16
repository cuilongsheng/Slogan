import type { FlatList } from 'react-native';
/** Native anchoring is owned by FlatList.maintainVisibleContentPosition. */
export function captureChatAnchor(_list: FlatList<unknown> | null): () => boolean {
  return () => true;
}
