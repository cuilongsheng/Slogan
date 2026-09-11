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
