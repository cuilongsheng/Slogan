export interface TokenPair {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AccessIdentity {
  userId: string;
  sessionId: string;
}

/** Created by the server guard, scoped to this request; never accepted from an HTTP body. */
export interface VerifiedAccessContext extends AccessIdentity {
  expiresAt: number;
  trial?: boolean;
  eligible?: boolean;
}
