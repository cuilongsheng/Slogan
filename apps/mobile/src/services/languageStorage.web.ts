const key = 'slogan.locale.v1';
export const languageStorage = {
  async get() {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(value: string) {
    localStorage.setItem(key, value);
  },
};
