import { createHmac, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { Environment } from '../../../../config/environment.js';
import type { AccessIdentity, TokenPair } from '../../domain/entities/auth-session.js';
import { AuthError } from '../../domain/errors/auth.error.js';
import { AUTH_REPOSITORY, type AuthRepository } from '../../domain/ports/auth.repository.js';

interface AccessClaims {
  sub: string;
  sid: string;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async issue(
    userId: string,
    deviceName?: string,
    now = new Date(),
    credentialVersion?: number,
  ): Promise<TokenPair> {
    const refreshToken = this.newRefreshToken();
    const refreshTokenExpiresAt = this.refreshExpiry(now);
    const { sessionId } = await this.repository.createSession({
      userId,
      ...(credentialVersion === undefined ? {} : { credentialVersion }),
      ...(deviceName === undefined ? {} : { deviceName }),
      digest: this.digest(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      now,
    });
    return this.tokenPair(userId, sessionId, refreshToken, refreshTokenExpiresAt);
  }

  async refresh(refreshToken: string, now = new Date()): Promise<TokenPair> {
    const nextToken = this.newRefreshToken();
    const nextExpiresAt = this.refreshExpiry(now);
    const result = await this.repository.rotateRefreshToken({
      digest: this.digest(refreshToken),
      nextDigest: this.digest(nextToken),
      nextExpiresAt,
      now,
    });
    if (result.status === 'REUSED') {
      throw new AuthError('REFRESH_TOKEN_REUSED', 'Refresh token reuse detected');
    }
    if (result.status === 'INVALID') {
      throw new AuthError('REFRESH_TOKEN_INVALID', 'Refresh token is invalid or expired');
    }
    return this.tokenPair(result.userId, result.sessionId, nextToken, result.expiresAt);
  }

  async revoke(identity: AccessIdentity, now = new Date()): Promise<void> {
    await this.repository.revokeSession(identity.userId, identity.sessionId, now);
  }

  async verifyAccessToken(token: string, now = new Date()): Promise<AccessIdentity> {
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        issuer: this.config.get('JWT_ISSUER', { infer: true }),
        audience: this.config.get('JWT_AUDIENCE', { infer: true }),
      });
      if (
        typeof claims.sub !== 'string' ||
        typeof claims.sid !== 'string' ||
        !(await this.repository.isSessionActive(claims.sub, claims.sid, now))
      ) {
        throw new AuthError('ACCESS_TOKEN_INVALID', 'Access token is invalid');
      }
      return { userId: claims.sub, sessionId: claims.sid };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('ACCESS_TOKEN_INVALID', 'Access token is invalid');
    }
  }

  private async tokenPair(
    userId: string,
    sessionId: string,
    refreshToken: string,
    refreshTokenExpiresAt: Date,
  ): Promise<TokenPair> {
    const accessTokenExpiresInSeconds = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwt.signAsync(
      { sid: sessionId },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        subject: userId,
        issuer: this.config.get('JWT_ISSUER', { infer: true }),
        audience: this.config.get('JWT_AUDIENCE', { infer: true }),
        expiresIn: accessTokenExpiresInSeconds,
      },
    );
    return { accessToken, accessTokenExpiresInSeconds, refreshToken, refreshTokenExpiresAt };
  }

  private newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private digest(token: string): string {
    return createHmac('sha256', this.config.get('REFRESH_TOKEN_PEPPER', { infer: true }))
      .update(token)
      .digest('hex');
  }

  private refreshExpiry(now: Date): Date {
    return new Date(
      now.getTime() + this.config.get('REFRESH_TOKEN_TTL_SECONDS', { infer: true }) * 1000,
    );
  }
}
