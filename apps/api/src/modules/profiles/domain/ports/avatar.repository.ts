export const AVATAR_REPOSITORY = Symbol('AVATAR_REPOSITORY');
export interface AvatarRepository {
  replace(userId: string, id: string, png: Uint8Array, sha256: string, url: string): Promise<void>;
  find(id: string): Promise<{ image: Uint8Array; sha256: string } | null>;
}

export const AVATAR_IMAGE = Symbol('AVATAR_IMAGE');
export interface AvatarImage {
  normalize(base64: string): Uint8Array;
  defaultImage(): Uint8Array;
}
