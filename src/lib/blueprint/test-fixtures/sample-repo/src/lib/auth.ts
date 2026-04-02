export type AuthClaims = {
  sub: string;
};

export function verifyToken(token: string): AuthClaims {
  return {
    sub: token.trim()
  };
}

export function requireAuth(token: string): AuthClaims {
  return verifyToken(token);
}
