// Select a visual default without inventing or publishing a user's gender.
export function defaultAvatarVariant(
  url: string | null,
  genderCode?: string | null,
): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/v1/avatars/default') return url;
    parsed.searchParams.set('variant', genderCode === 'female' ? 'female' : 'male');
    return parsed.toString();
  } catch {
    return url;
  }
}
