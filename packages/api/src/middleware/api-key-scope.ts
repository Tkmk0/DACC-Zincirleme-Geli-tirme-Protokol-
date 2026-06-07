import type { FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError, isJwtPayload } from "@dacc/core";

export function requireScope(scope: string) {
  return async (request: FastifyRequest) => {
    const p = request.principal;
    if (!p) throw new UnauthorizedError();
    // JWT principals (users) bypass scope checks — they inherit all permissions
    if (isJwtPayload(p)) return;
    if (!p.scopes.includes(scope)) {
      throw new ForbiddenError(`API key missing required scope: ${scope}`);
    }
  };
}

export function requireAnyScope(...scopes: string[]) {
  return async (request: FastifyRequest) => {
    const p = request.principal;
    if (!p) throw new UnauthorizedError();
    if (isJwtPayload(p)) return;
    const hasAny = scopes.some((s) => p.scopes.includes(s));
    if (!hasAny) {
      throw new ForbiddenError(`API key requires one of: ${scopes.join(", ")}`);
    }
  };
}
