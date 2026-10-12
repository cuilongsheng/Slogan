import * as SecureStore from 'expo-secure-store';
export const roomExitStorage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
};
