// @module: server-auth-jwt
// @tags: auth, jwt, tokens

import jwt from 'jsonwebtoken';
import type { ServerConfig } from '../config.js';
import type { AuthenticatedUser, PublicUser } from './types.js';

export interface TokenClaims extends jwt.JwtPayload {
  sub: string;
  username: string;
  roles?: string[];
}

function assertValidClaims(
  claims: TokenClaims,
): asserts claims is TokenClaims & { sub: string; username: string } {
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new Error('Token is missing required subject claim');
  }

  if (typeof claims.username !== 'string' || claims.username.length === 0) {
    throw new Error('Token is missing username claim');
  }
}

export const signToken = (user: PublicUser, config: ServerConfig): string => {
  const payload: TokenClaims = {
    sub: user.id,
    username: user.username,
    roles: user.roles,
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    expiresIn: config.TOKEN_TTL_SECONDS,
  });
};

export const decodeToken = (
  token: string,
  config: ServerConfig,
): AuthenticatedUser => {
  const decoded = jwt.verify(token, config.JWT_SECRET, {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });

  if (typeof decoded === 'string') {
    throw new Error('Unexpected token payload type');
  }

  const claims = decoded as TokenClaims;
  assertValidClaims(claims);

  return {
    id: claims.sub,
    username: claims.username,
    roles: Array.isArray(claims.roles) ? claims.roles : [],
  };
};
