import { fetch as nativeFetch } from 'expo/fetch';
export const streamFetch: typeof fetch = nativeFetch;
