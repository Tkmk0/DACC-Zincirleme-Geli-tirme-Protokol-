export interface JwtPayload {
  sub: string; // userId
  tenantId: string;
  role: string;
  sessionId?: string;
  iat: number;
  exp: number;
}

export interface ApiKeyPayload {
  keyId: string;
  tenantId: string;
  scopes: string[];
  operatorType: "api_key";
}

export type AuthPrincipal = JwtPayload | ApiKeyPayload;

export function isJwtPayload(p: AuthPrincipal): p is JwtPayload {
  return "sub" in p;
}

export function isApiKeyPayload(p: AuthPrincipal): p is ApiKeyPayload {
  return "keyId" in p;
}
