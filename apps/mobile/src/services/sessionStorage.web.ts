type Storage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

// Browser credentials live in an HttpOnly API cookie. This adapter never persists tokens.
export const browserSession = true;
export const sessionStorage: Storage = {
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
};

// Only non-credential Google name/avatar hints survive a same-tab reload.
export const profileHintStorage: Storage = {
  getItemAsync: async (key) => {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItemAsync: async (key, value) => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Storage can be disabled; login must still work for this page.
    }
  },
  deleteItemAsync: async (key) => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage can be disabled; the credential is still revoked by the API.
    }
  },
};
