import * as SecureStore from 'expo-secure-store';

type Storage = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;

export const browserSession = false;
export const sessionStorage: Storage = SecureStore;
export const profileHintStorage = {
  getItemAsync: async (_key: string): Promise<string | null> => null,
  setItemAsync: async (_key: string, _value: string): Promise<void> => {},
  deleteItemAsync: async (_key: string): Promise<void> => {},
};
