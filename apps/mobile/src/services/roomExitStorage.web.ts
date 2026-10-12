// Only account-bound exit intent; never credentials, passwords or recordings.
export const roomExitStorage = {
  get: async (key: string) => window.localStorage.getItem(key),
  set: async (key: string, value: string) => window.localStorage.setItem(key, value),
};
