import { useEffect, useState } from 'react';

// Mail links place single-use credentials in the fragment, which is never sent to the server.
export function useEmailLinkToken(purpose: 'REGISTER' | 'RESET_PASSWORD'): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const consume = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const value = params.get('token');
      if (params.get('purpose') === purpose && value && /^[A-Za-z0-9_-]{43}$/.test(value)) {
        setToken(value);
      }
      if (window.location.hash) {
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname + window.location.search,
        );
      }
    };
    consume();
    window.addEventListener('hashchange', consume);
    // The router can write its initial URL after this child effect on a cold navigation.
    const afterRouter = window.setTimeout(consume, 0);
    return () => {
      window.clearTimeout(afterRouter);
      window.removeEventListener('hashchange', consume);
    };
  }, [purpose]);
  return token;
}
