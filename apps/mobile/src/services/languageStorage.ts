import * as SecureStore from 'expo-secure-store';
const key = 'slogan.locale.v1';
export const languageStorage = {
  get: () => SecureStore.getItemAsync(key),
  set: (value: string) => SecureStore.setItemAsync(key, value),
};
